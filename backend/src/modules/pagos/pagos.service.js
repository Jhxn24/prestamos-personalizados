const Decimal = require('decimal.js');
const prisma = require('../../config/prisma');
const {
  distribuirPago,
  estadoDeCuota,
  recalcularCuotasPendientes,
  recalcularPlazoReducido,
  calcularInteresAnticipado,
  calcularCuotaFija,
  tasaPorCuota,
  ErrorMotorCalculo,
} = require('../motor-calculo');
const { actualizarMoraDePrestamo } = require('../mora/mora.service');
const notificacionesService = require('../notificaciones/notificaciones.service');
const auditoriaService = require('../auditoria/auditoria.service');

const INCLUDE_PAGO = {
  recibo: true,
  cuota: { select: { id: true, numero: true, estado: true, total: true, montoPagado: true } },
  prestamo: { select: { id: true, clienteId: true, estado: true, capitalPendiente: true } },
};

const dec = (valor) => new Decimal(valor.toString());

/** RF-27: avisa al cliente dueño del préstamo el resultado de su pago. */
async function notificarCliente(pagoId, { tipo, titulo, mensaje }) {
  const pago = await prisma.pago.findUnique({
    where: { id: pagoId },
    select: {
      prestamoId: true,
      cuotaId: true,
      prestamo: { select: { cliente: { select: { usuarioId: true } } } },
    },
  });
  if (!pago) return;

  await notificacionesService.crear({
    usuarioId: pago.prestamo.cliente.usuarioId,
    tipo,
    titulo,
    mensaje,
    prestamoId: pago.prestamoId,
    cuotaId: pago.cuotaId,
    pagoId,
  });
}

/**
 * Reporte de pago del cliente (RF-21) o registro directo del administrador (RF-25).
 *
 * Un pago reportado por el cliente nace PENDIENTE_CONFIRMACION y NO toca el
 * préstamo (RF-22): la contabilidad solo se mueve al confirmar. El pago que
 * registra el administrador se da por confirmado en el acto, porque es él quien
 * recibió el dinero.
 */
async function registrarPago(
  {
    cuotaId,
    monto,
    metodo,
    comprobanteUrl,
    observaciones,
    fechaPago,
    politicaInteresAnticipado,
    politicaAbonoExtraordinario,
  },
  usuario
) {
  const cuota = await prisma.cuota.findUnique({
    where: { id: cuotaId },
    include: { prestamo: { include: { cliente: true } } },
  });

  if (!cuota) {
    return { error: 'CUOTA_NO_ENCONTRADA' };
  }

  const { prestamo } = cuota;

  if (usuario.rol === 'CLIENTE' && prestamo.cliente.usuarioId !== usuario.id) {
    return { error: 'SIN_ACCESO' };
  }

  if (prestamo.estado !== 'ACTIVO') {
    throw new ErrorMotorCalculo(
      `No se pueden registrar pagos sobre un préstamo en estado ${prestamo.estado}`
    );
  }

  if (cuota.estado === 'PAGADA') {
    throw new ErrorMotorCalculo(`La cuota ${cuota.numero} ya está pagada`);
  }

  const montoDecimal = dec(monto ?? 0);
  if (montoDecimal.lte(0)) {
    throw new ErrorMotorCalculo('El monto del pago debe ser mayor a 0');
  }

  const esAdministrador = usuario.rol === 'ADMINISTRADOR';

  const pago = await prisma.pago.create({
    data: {
      prestamoId: prestamo.id,
      cuotaId: cuota.id,
      monto: montoDecimal.toFixed(2),
      metodo: metodo ?? 'EFECTIVO',
      comprobanteUrl: comprobanteUrl ?? null,
      observaciones: observaciones ?? null,
      fechaPago: fechaPago ? new Date(fechaPago) : new Date(),
      estado: esAdministrador ? 'CONFIRMADO' : 'PENDIENTE_CONFIRMACION',
      // RF-14: la política del interés anticipado la decide el administrador.
      // Un cliente que reporta su pago no puede condonarse interés a sí mismo.
      politicaInteresAnticipado: esAdministrador
        ? politicaInteresAnticipado ?? 'COMPLETO'
        : 'COMPLETO',
      // RF-17: qué hacer con el excedente también lo decide el administrador.
      politicaAbonoExtraordinario: esAdministrador
        ? politicaAbonoExtraordinario ?? 'REDUCIR_CUOTA'
        : 'REDUCIR_CUOTA',
      registradoPorId: usuario.id,
    },
  });

  // El pago del administrador ya viene confirmado: se aplica de inmediato.
  if (esAdministrador) {
    const pagoAplicado = await aplicarPago(pago.id, usuario.id);
    await notificarCliente(pago.id, {
      tipo: 'PAGO_CONFIRMADO',
      titulo: 'Pago registrado',
      mensaje: `Se registró tu pago de S/ ${montoDecimal.toFixed(2)} para la cuota #${cuota.numero}.`,
    });
    await auditoriaService.registrar({
      usuarioId: usuario.id,
      entidad: 'PAGO',
      entidadId: pago.id,
      accion: 'CONFIRMAR',
      detalle: `Pago directo registrado por el administrador: S/ ${montoDecimal.toFixed(2)} para la cuota #${cuota.numero} del préstamo ${prestamo.id}.`,
    });
    return { pago: pagoAplicado };
  }

  // RF-27 (recibido): confirmación al cliente de que su reporte llegó.
  // RF-28: aviso a los administradores de que hay un pago pendiente de confirmar.
  await notificarCliente(pago.id, {
    tipo: 'PAGO_REPORTADO',
    titulo: 'Reportaste un pago',
    mensaje: `Registramos tu pago de S/ ${montoDecimal.toFixed(2)} para la cuota #${cuota.numero}, pendiente de confirmación.`,
  });
  await notificacionesService.crearParaAdministradores({
    tipo: 'PAGO_REPORTADO',
    titulo: 'Nuevo pago reportado',
    mensaje: `${prestamo.cliente.nombre} ${prestamo.cliente.apellido} reportó un pago de S/ ${montoDecimal.toFixed(2)} para la cuota #${cuota.numero}, pendiente de confirmar.`,
    prestamoId: prestamo.id,
    cuotaId: cuota.id,
    pagoId: pago.id,
  });
  await auditoriaService.registrar({
    usuarioId: usuario.id,
    entidad: 'PAGO',
    entidadId: pago.id,
    accion: 'CREAR',
    detalle: `Pago reportado por el cliente: S/ ${montoDecimal.toFixed(2)} para la cuota #${cuota.numero} del préstamo ${prestamo.id}, pendiente de confirmación.`,
  });

  return { pago: await obtenerPagoPorId(pago.id) };
}

/**
 * Confirma un pago reportado y lo aplica al préstamo (RF-23, RF-11).
 *
 * Es aquí donde el administrador resuelve el interés de un pago anticipado
 * (RF-14): al revisar el comprobante ve la fecha real del pago y decide si
 * cobra el periodo completo o solo lo devengado.
 */
async function confirmarPago(
  pagoId,
  usuarioId,
  { politicaInteresAnticipado, politicaAbonoExtraordinario } = {}
) {
  const pago = await prisma.pago.findUnique({ where: { id: pagoId } });

  if (!pago) {
    return { error: 'PAGO_NO_ENCONTRADO' };
  }
  if (pago.estado !== 'PENDIENTE_CONFIRMACION') {
    throw new ErrorMotorCalculo(`Solo se puede confirmar un pago pendiente (estado actual: ${pago.estado})`);
  }

  if (politicaInteresAnticipado || politicaAbonoExtraordinario) {
    await prisma.pago.update({
      where: { id: pagoId },
      data: {
        ...(politicaInteresAnticipado ? { politicaInteresAnticipado } : {}),
        ...(politicaAbonoExtraordinario ? { politicaAbonoExtraordinario } : {}),
      },
    });
  }

  const pagoAplicado = await aplicarPago(pagoId, usuarioId);
  await notificarCliente(pagoId, {
    tipo: 'PAGO_CONFIRMADO',
    titulo: 'Tu pago fue confirmado',
    mensaje: `Confirmamos tu pago de S/ ${dec(pagoAplicado.monto).toFixed(2)} para la cuota #${pagoAplicado.cuota?.numero ?? ''}.`.trim(),
  });
  await auditoriaService.registrar({
    usuarioId,
    entidad: 'PAGO',
    entidadId: pagoId,
    accion: 'CONFIRMAR',
    detalle: `Pago confirmado: S/ ${dec(pagoAplicado.monto).toFixed(2)} para la cuota #${pagoAplicado.cuota?.numero ?? ''}.`.trim(),
  });
  return { pago: pagoAplicado };
}

/**
 * Rechaza un pago reportado (RF-23). No mueve nada de la contabilidad.
 */
async function rechazarPago(pagoId, usuarioId, motivoRechazo) {
  const pago = await prisma.pago.findUnique({ where: { id: pagoId } });

  if (!pago) {
    return { error: 'PAGO_NO_ENCONTRADO' };
  }
  if (pago.estado !== 'PENDIENTE_CONFIRMACION') {
    throw new ErrorMotorCalculo(`Solo se puede rechazar un pago pendiente (estado actual: ${pago.estado})`);
  }

  const actualizado = await prisma.pago.update({
    where: { id: pagoId },
    data: {
      estado: 'RECHAZADO',
      motivoRechazo: motivoRechazo ?? null,
      confirmadoPorId: usuarioId,
      fechaConfirmacion: new Date(),
    },
    include: INCLUDE_PAGO,
  });

  await notificarCliente(pagoId, {
    tipo: 'PAGO_RECHAZADO',
    titulo: 'Tu pago fue rechazado',
    mensaje: motivoRechazo
      ? `Rechazamos tu pago de S/ ${dec(actualizado.monto).toFixed(2)}: ${motivoRechazo}`
      : `Rechazamos tu pago de S/ ${dec(actualizado.monto).toFixed(2)}.`,
  });
  await auditoriaService.registrar({
    usuarioId,
    entidad: 'PAGO',
    entidadId: pagoId,
    accion: 'RECHAZAR',
    detalle: motivoRechazo
      ? `Pago rechazado: ${motivoRechazo}`
      : 'Pago rechazado.',
  });

  return { pago: actualizado };
}

/**
 * Aplica un pago al préstamo dentro de UNA transacción (RF-11, RF-19).
 *
 * Todo lo que sigue debe ocurrir junto o no ocurrir: repartir el pago, mover el
 * estado de la cuota, bajar el capital pendiente del préstamo, reescribir el
 * cronograma futuro y emitir el recibo. Un fallo a mitad de camino dejaría el
 * saldo del préstamo desalineado con sus cuotas, que es exactamente el tipo de
 * inconsistencia que no se puede permitir con dinero real.
 */
function aplicarPago(pagoId, usuarioId) {
  return prisma.$transaction(async (tx) => {
    const pagoInicial = await tx.pago.findUnique({ where: { id: pagoId }, include: { prestamo: true } });

    // 1. Poner la mora al día a la fecha del pago, para que el dinero recibido
    //    pueda cubrirla (RF-16). Esto puede marcar cuotas como VENCIDAS.
    await actualizarMoraDePrestamo(tx, pagoInicial.prestamoId, pagoInicial.fechaPago);

    const pago = await tx.pago.findUnique({
      where: { id: pagoId },
      include: { cuota: true, prestamo: true },
    });

    const { cuota, prestamo } = pago;

    // 2. Resolver el interés si la cuota se paga antes de vencer (RF-14).
    const { interesDeLaCuota, interesCondonado } = await resolverInteresAnticipado(tx, { pago, cuota, prestamo });

    // 3. Repartir el pago: mora, luego interés, luego capital de la cuota.
    const moraPendiente = dec(cuota.mora).minus(dec(cuota.moraPagada));
    const interesPendiente = interesDeLaCuota.minus(dec(cuota.interesPagado));
    const capitalPendienteCuota = dec(cuota.capital).minus(dec(cuota.capitalPagado));

    const { moraAplicada, interesAplicado, capitalAplicado, excedente } = distribuirPago({
      monto: dec(pago.monto),
      moraPendiente,
      interesPendiente,
      capitalPendiente: capitalPendienteCuota,
    });

    // 4. El excedente se abona a capital, así que la reducción total de capital
    //    no puede superar lo que realmente se debe.
    const reduccionCapital = capitalAplicado.plus(excedente);
    const capitalPendientePrestamo = dec(prestamo.capitalPendiente);

    if (reduccionCapital.gt(capitalPendientePrestamo)) {
      throw new ErrorMotorCalculo(
        `El pago excede la deuda pendiente del préstamo (capital pendiente: ${capitalPendientePrestamo.toFixed(2)})`
      );
    }

    // 5. Actualizar la cuota pagada.
    const nuevoCapitalPagado = dec(cuota.capitalPagado).plus(capitalAplicado);
    const nuevoInteresPagado = dec(cuota.interesPagado).plus(interesAplicado);
    const nuevaMoraPagada = dec(cuota.moraPagada).plus(moraAplicada);
    const nuevoMontoPagado = nuevoCapitalPagado.plus(nuevoInteresPagado).plus(nuevaMoraPagada);
    const nuevoTotalCuota = dec(cuota.capital).plus(interesDeLaCuota);

    await tx.cuota.update({
      where: { id: cuota.id },
      data: {
        interes: interesDeLaCuota.toFixed(2),
        total: nuevoTotalCuota.toFixed(2),
        capitalPagado: nuevoCapitalPagado.toFixed(2),
        interesPagado: nuevoInteresPagado.toFixed(2),
        moraPagada: nuevaMoraPagada.toFixed(2),
        montoPagado: nuevoMontoPagado.toFixed(2),
        estado: estadoDeCuota({
          montoPagado: nuevoMontoPagado,
          total: nuevoTotalCuota,
          mora: dec(cuota.mora),
          vencida: cuota.diasAtraso > 0,
        }),
      },
    });

    // 6. Bajar el capital pendiente y acumular lo cobrado.
    const nuevoCapitalPendiente = capitalPendientePrestamo.minus(reduccionCapital);
    const nuevoInteresAcumulado = dec(prestamo.interesAcumulado).plus(interesAplicado);

    // 7. Reescribir el cronograma futuro con el saldo real (RF-17: reducir el
    //    importe de las cuotas o el plazo, según lo que decida el administrador).
    const cuotasEliminadas = await recalcularCronogramaFuturo(tx, {
      prestamo,
      cuotaPagada: cuota,
      nuevoCapitalPendiente,
      excedente,
      politicaAbono: pago.politicaAbonoExtraordinario,
    });

    // 8. Cerrar el préstamo si ya no queda nada por cobrar.
    const cuotasAbiertas = await tx.cuota.count({
      where: { prestamoId: prestamo.id, estado: { not: 'PAGADA' }, total: { gt: 0 } },
    });
    const estadoPrestamo = nuevoCapitalPendiente.lte(0) && cuotasAbiertas === 0 ? 'PAGADO' : prestamo.estado;

    await tx.prestamo.update({
      where: { id: prestamo.id },
      data: {
        capitalPendiente: nuevoCapitalPendiente.toFixed(2),
        interesAcumulado: nuevoInteresAcumulado.toFixed(2),
        estado: estadoPrestamo,
      },
    });

    // 9. Registrar el reparto y emitir el recibo (RF-24).
    await tx.pago.update({
      where: { id: pago.id },
      data: {
        estado: 'CONFIRMADO',
        moraAplicada: moraAplicada.toFixed(2),
        capitalAplicado: capitalAplicado.toFixed(2),
        interesAplicado: interesAplicado.toFixed(2),
        excedente: excedente.toFixed(2),
        interesCondonado: interesCondonado.toFixed(2),
        cuotasEliminadas,
        confirmadoPorId: usuarioId,
        fechaConfirmacion: new Date(),
      },
    });

    await tx.recibo.upsert({
      where: { pagoId: pago.id },
      create: { pagoId: pago.id, monto: dec(pago.monto).toFixed(2) },
      update: {},
    });

    return tx.pago.findUnique({ where: { id: pago.id }, include: INCLUDE_PAGO });
  });
}

/**
 * Aplica la política de interés anticipado del pago (RF-14).
 *
 * Solo tiene efecto si la cuota se paga antes de su vencimiento y todavía no
 * tiene ningún abono: si ya se cobró parte del interés al monto completo,
 * recortarlo ahora dejaría la cuota con más interés pagado del que debe.
 *
 * El periodo de devengo va del vencimiento de la cuota anterior (o del
 * desembolso, si es la primera) al vencimiento de esta.
 */
async function resolverInteresAnticipado(tx, { pago, cuota, prestamo }) {
  const interesActual = dec(cuota.interes);

  if (pago.politicaInteresAnticipado !== 'PROPORCIONAL') {
    return { interesDeLaCuota: interesActual, interesCondonado: new Decimal(0) };
  }

  if (!dec(cuota.montoPagado).isZero()) {
    throw new ErrorMotorCalculo(
      'No se puede prorratear el interés de una cuota que ya tiene pagos aplicados'
    );
  }

  const cuotaAnterior =
    cuota.numero > 1
      ? await tx.cuota.findFirst({
          where: { prestamoId: prestamo.id, numero: cuota.numero - 1 },
          select: { fechaVencimiento: true },
        })
      : null;

  const { interes, condonado } = calcularInteresAnticipado({
    interesCuota: interesActual,
    inicioPeriodo: cuotaAnterior?.fechaVencimiento ?? prestamo.fechaDesembolso,
    fechaVencimiento: cuota.fechaVencimiento,
    fechaPago: pago.fechaPago,
    politica: 'PROPORCIONAL',
  });

  return { interesDeLaCuota: interes, interesCondonado: condonado };
}

/**
 * Reparte el saldo real entre las cuotas futuras que nadie ha tocado todavía.
 *
 * Solo se tocan las cuotas POSTERIORES a la que se acaba de pagar y que no
 * tienen ningún abono: una cuota parcial conserva su propio saldo por cobrar y
 * una cuota vencida sin pagar mantiene lo que se le reclamó al cliente.
 *
 * Las fechas de vencimiento no se mueven — el cliente pactó esas fechas.
 *
 * Con REDUCIR_PLAZO (RF-17) el reparto cambia: en vez de estirar el saldo entre
 * todas las cuotas restantes, se amortiza al ritmo pactado y sobran cuotas al
 * final, que se eliminan del cronograma.
 */
async function recalcularCronogramaFuturo(
  tx,
  { prestamo, cuotaPagada, nuevoCapitalPendiente, excedente, politicaAbono }
) {
  const cuotas = await tx.cuota.findMany({
    where: { prestamoId: prestamo.id },
    orderBy: { numero: 'asc' },
  });

  const regenerables = cuotas.filter(
    (cuota) => cuota.numero > cuotaPagada.numero && dec(cuota.montoPagado).isZero()
  );

  if (regenerables.length === 0) {
    return 0;
  }

  // Capital que sigue reclamado por cuotas que NO se regeneran (parciales o
  // vencidas): no puede repartirse otra vez entre las futuras o se cobraría doble.
  // Incluye a la cuota recién pagada si quedó parcial — `cuotas` ya trae su
  // versión actualizada, con el capital que todavía debe.
  const idsRegenerables = new Set(regenerables.map((cuota) => cuota.id));
  const capitalComprometido = cuotas
    .filter((cuota) => !idsRegenerables.has(cuota.id))
    .reduce((acumulado, cuota) => {
      const porCobrar = dec(cuota.capital).minus(dec(cuota.capitalPagado));
      return porCobrar.gt(0) ? acumulado.plus(porCobrar) : acumulado;
    }, new Decimal(0));

  const capitalARepartir = Decimal.max(nuevoCapitalPendiente.minus(capitalComprometido), 0);

  const tasa = tasaPorCuota({
    tasaInteres: dec(prestamo.tasaInteres),
    tipoInteres: prestamo.tipoInteres,
    frecuenciaPago: prestamo.frecuenciaPago,
    diasPersonalizados: prestamo.diasPersonalizados ?? undefined,
  });

  // RF-17: acortar el plazo solo tiene sentido si hubo abono extraordinario.
  const acortarPlazo = politicaAbono === 'REDUCIR_PLAZO' && excedente.gt(0);

  const nuevasCuotas = acortarPlazo
    ? recalcularPlazoReducido({
        saldoInicial: nuevoCapitalPendiente,
        capitalARepartir,
        capitalOriginal: dec(prestamo.capital),
        capitalPorCuotaOriginal: dec(prestamo.capital).div(prestamo.numeroCuotas),
        cuotaFijaOriginal: calcularCuotaFija({
          capital: dec(prestamo.capital),
          tasaPorCuota: tasa,
          numeroCuotas: prestamo.numeroCuotas,
        }),
        tasaPorCuota: tasa,
        modalidad: prestamo.modalidad,
        maximoCuotas: regenerables.length,
      })
    : recalcularCuotasPendientes({
        saldoInicial: nuevoCapitalPendiente,
        capitalARepartir,
        capitalOriginal: dec(prestamo.capital),
        tasaPorCuota: tasa,
        modalidad: prestamo.modalidad,
        numeroCuotasPendientes: regenerables.length,
      });

  const aRegenerar = regenerables.slice(0, nuevasCuotas.length);
  const sobrantes = regenerables.slice(nuevasCuotas.length);

  await Promise.all(
    aRegenerar.map((cuota, indice) =>
      tx.cuota.update({
        where: { id: cuota.id },
        data: {
          capital: nuevasCuotas[indice].capital.toFixed(2),
          interes: nuevasCuotas[indice].interes.toFixed(2),
          total: nuevasCuotas[indice].total.toFixed(2),
          saldoCapital: nuevasCuotas[indice].saldoCapital.toFixed(2),
        },
      })
    )
  );

  if (sobrantes.length === 0) {
    return 0;
  }

  // Las cuotas que ya no hacen falta desaparecen del cronograma. Solo se
  // eliminan cuotas sin ningún abono, así que no se pierde historial de cobros;
  // un pago rechazado que las referenciara conserva su registro con la cuota en
  // nulo (la relación es opcional).
  await tx.cuota.deleteMany({ where: { id: { in: sobrantes.map((cuota) => cuota.id) } } });

  await tx.prestamo.update({
    where: { id: prestamo.id },
    data: { numeroCuotas: cuotas.length - sobrantes.length },
  });

  return sobrantes.length;
}

function listarPagos({ clienteId, estado, prestamoId } = {}) {
  return prisma.pago.findMany({
    where: {
      estado: estado || undefined,
      prestamoId: prestamoId || undefined,
      prestamo: clienteId ? { clienteId } : undefined,
    },
    include: INCLUDE_PAGO,
    orderBy: { createdAt: 'desc' },
  });
}

function obtenerPagoPorId(id) {
  return prisma.pago.findUnique({ where: { id }, include: INCLUDE_PAGO });
}

module.exports = {
  registrarPago,
  confirmarPago,
  rechazarPago,
  listarPagos,
  obtenerPagoPorId,
};
