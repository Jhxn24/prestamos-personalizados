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

/** Mismo criterio de alcance que `prestamos.service.js`, pero vía la relación Pago -> Prestamo. */
function filtroAlcance({ administradorId, clienteId } = {}) {
  if (clienteId) return { prestamo: { clienteId } };
  if (administradorId) return { prestamo: { cliente: { administradorId } } };
  return undefined;
}

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

  // Un cliente sin cuenta de acceso (RF-04 opcional) no tiene a quién notificar.
  if (!pago.prestamo.cliente.usuarioId) return;

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
 * Registro directo de un pago por el administrador (RF-25).
 *
 * Ya no existe un paso de confirmación: el administrador marca el pago como
 * realizado y se aplica al préstamo de inmediato, en el mismo acto.
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
  usuarioId
) {
  const cuota = await prisma.cuota.findFirst({
    where: { id: cuotaId, prestamo: { cliente: { administradorId: usuarioId } } },
    include: { prestamo: { include: { cliente: true } } },
  });

  if (!cuota) {
    return { error: 'CUOTA_NO_ENCONTRADA' };
  }

  const { prestamo } = cuota;

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

  const pago = await prisma.pago.create({
    data: {
      prestamoId: prestamo.id,
      cuotaId: cuota.id,
      monto: montoDecimal.toFixed(2),
      metodo: metodo ?? 'EFECTIVO',
      comprobanteUrl: comprobanteUrl ?? null,
      observaciones: observaciones ?? null,
      fechaPago: fechaPago ? new Date(fechaPago) : new Date(),
      estado: 'CONFIRMADO',
      // RF-14/RF-17: el administrador decide estas políticas al marcar el pago.
      politicaInteresAnticipado: politicaInteresAnticipado ?? 'COMPLETO',
      politicaAbonoExtraordinario: politicaAbonoExtraordinario ?? 'REDUCIR_CUOTA',
      registradoPorId: usuarioId,
    },
  });

  const pagoAplicado = await aplicarPago(pago.id, usuarioId);
  await notificarCliente(pago.id, {
    tipo: 'PAGO_CONFIRMADO',
    titulo: 'Pago registrado',
    mensaje: `Se registró tu pago de S/ ${montoDecimal.toFixed(2)} para la cuota #${cuota.numero}.`,
  });
  await auditoriaService.registrar({
    usuarioId,
    entidad: 'PAGO',
    entidadId: pago.id,
    accion: 'CONFIRMAR',
    detalle: `Pago registrado por el administrador: S/ ${montoDecimal.toFixed(2)} para la cuota #${cuota.numero} del préstamo ${prestamo.id}.`,
  });
  return { pago: pagoAplicado };
}

/**
 * Anula un pago marcado por error (reemplaza al antiguo rechazar/confirmar).
 *
 * Solo se puede anular el pago CONFIRMADO más reciente de un préstamo (LIFO):
 * así se garantiza que nada posterior dependió ya de sus efectos y basta con
 * restaurar el snapshot tomado al aplicarlo, sin tener que re-derivar la
 * inversa exacta de `aplicarPago`.
 *
 * Si el pago llegó a eliminar cuotas del cronograma (RF-17 reducir plazo), no
 * se anula automáticamente: reconstruirlas de forma segura queda fuera de
 * alcance de esta primera versión.
 */
async function anularPago(pagoId, usuarioId, motivo) {
  const actualizado = await prisma.$transaction(async (tx) => {
    const pago = await tx.pago.findFirst({
      where: { id: pagoId, prestamo: { cliente: { administradorId: usuarioId } } },
      include: { snapshot: true },
    });

    if (!pago) {
      return null;
    }
    if (pago.estado !== 'CONFIRMADO') {
      throw new ErrorMotorCalculo(`Solo se puede anular un pago confirmado (estado actual: ${pago.estado})`);
    }
    if (pago.cuotasEliminadas > 0) {
      throw new ErrorMotorCalculo(
        'Este pago redujo el plazo del préstamo (eliminó cuotas del cronograma); no se puede anular automáticamente.'
      );
    }

    const masReciente = await tx.pago.findFirst({
      where: { prestamoId: pago.prestamoId, estado: 'CONFIRMADO', createdAt: { gt: pago.createdAt } },
      select: { id: true },
    });
    if (masReciente) {
      throw new ErrorMotorCalculo(
        'Solo se puede anular el pago confirmado más reciente de este préstamo; anula primero los posteriores.'
      );
    }

    const { prestamo, cuotaPagada, cuotasModificadas } = pago.snapshot.datos;

    await tx.prestamo.update({
      where: { id: pago.prestamoId },
      data: {
        capitalPendiente: prestamo.capitalPendiente,
        interesAcumulado: prestamo.interesAcumulado,
        estado: prestamo.estado,
      },
    });

    await tx.cuota.update({
      where: { id: cuotaPagada.id },
      data: {
        interes: cuotaPagada.interes,
        total: cuotaPagada.total,
        capitalPagado: cuotaPagada.capitalPagado,
        interesPagado: cuotaPagada.interesPagado,
        moraPagada: cuotaPagada.moraPagada,
        montoPagado: cuotaPagada.montoPagado,
        estado: cuotaPagada.estado,
      },
    });

    await Promise.all(
      cuotasModificadas.map((cuota) =>
        tx.cuota.update({
          where: { id: cuota.id },
          data: {
            capital: cuota.capital,
            interes: cuota.interes,
            total: cuota.total,
            saldoCapital: cuota.saldoCapital,
          },
        })
      )
    );

    await tx.recibo.deleteMany({ where: { pagoId } });

    return tx.pago.update({
      where: { id: pagoId },
      data: {
        estado: 'ANULADO',
        anuladoPorId: usuarioId,
        fechaAnulacion: new Date(),
        motivoAnulacion: motivo ?? null,
      },
      include: INCLUDE_PAGO,
    });
  });

  if (!actualizado) {
    return { error: 'PAGO_NO_ENCONTRADO' };
  }

  await notificarCliente(pagoId, {
    tipo: 'PAGO_ANULADO',
    titulo: 'Se anuló un pago',
    mensaje: motivo
      ? `Se anuló tu pago de S/ ${dec(actualizado.monto).toFixed(2)}: ${motivo}`
      : `Se anuló tu pago de S/ ${dec(actualizado.monto).toFixed(2)}.`,
  });
  await auditoriaService.registrar({
    usuarioId,
    entidad: 'PAGO',
    entidadId: pagoId,
    accion: 'ANULAR',
    detalle: motivo ? `Pago anulado: ${motivo}` : 'Pago anulado.',
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
    const { cuotasEliminadas, cuotasModificadas } = await recalcularCronogramaFuturo(tx, {
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

    // 10. Guardar el estado PREVIO (préstamo, cuota pagada y cuotas futuras
    //     regeneradas) para poder revertir este pago con `anularPago`.
    await tx.pagoSnapshot.create({
      data: {
        pagoId: pago.id,
        datos: {
          prestamo: {
            capitalPendiente: prestamo.capitalPendiente.toString(),
            interesAcumulado: prestamo.interesAcumulado.toString(),
            estado: prestamo.estado,
          },
          cuotaPagada: {
            id: cuota.id,
            interes: cuota.interes.toString(),
            total: cuota.total.toString(),
            capitalPagado: cuota.capitalPagado.toString(),
            interesPagado: cuota.interesPagado.toString(),
            moraPagada: cuota.moraPagada.toString(),
            montoPagado: cuota.montoPagado.toString(),
            estado: cuota.estado,
          },
          cuotasModificadas,
        },
      },
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
    return { cuotasEliminadas: 0, cuotasModificadas: [] };
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

  // Capital al final no soporta reducir el plazo en esta versión: el capital
  // está concentrado en la última cuota, no repartido parejo, así que la
  // amortización a "capital por cuota constante" de `plazo.js` generaría un
  // cronograma incorrecto en silencio en vez de fallar.
  if (acortarPlazo && prestamo.modalidad === 'CAPITAL_AL_FINAL') {
    throw new ErrorMotorCalculo(
      'REDUCIR_PLAZO no está disponible para la modalidad Capital al final; usa REDUCIR_CUOTA.'
    );
  }

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

  // Snapshot PREVIO a la actualización, para que `anularPago` pueda restaurar
  // exactamente estos valores.
  const cuotasModificadas = aRegenerar.map((cuota) => ({
    id: cuota.id,
    capital: cuota.capital.toString(),
    interes: cuota.interes.toString(),
    total: cuota.total.toString(),
    saldoCapital: cuota.saldoCapital.toString(),
  }));

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
    return { cuotasEliminadas: 0, cuotasModificadas };
  }

  // Las cuotas que ya no hacen falta desaparecen del cronograma. Solo se
  // eliminan cuotas sin ningún abono, así que no se pierde historial de cobros;
  // un pago anulado que las referenciara conserva su registro con la cuota en
  // nulo (la relación es opcional). Un pago que elimina cuotas no se puede
  // anular automáticamente (ver `anularPago`), así que no hace falta
  // snapshotearlas para poder restaurarlas.
  await tx.cuota.deleteMany({ where: { id: { in: sobrantes.map((cuota) => cuota.id) } } });

  await tx.prestamo.update({
    where: { id: prestamo.id },
    data: { numeroCuotas: cuotas.length - sobrantes.length },
  });

  return { cuotasEliminadas: sobrantes.length, cuotasModificadas };
}

function listarPagos({ clienteId, administradorId, estado, prestamoId } = {}) {
  return prisma.pago.findMany({
    where: {
      estado: estado || undefined,
      prestamoId: prestamoId || undefined,
      ...filtroAlcance({ clienteId, administradorId }),
    },
    include: INCLUDE_PAGO,
    orderBy: { createdAt: 'desc' },
  });
}

function obtenerPagoPorId(id, alcance = {}) {
  return prisma.pago.findFirst({ where: { id, ...filtroAlcance(alcance) }, include: INCLUDE_PAGO });
}

module.exports = {
  registrarPago,
  anularPago,
  listarPagos,
  obtenerPagoPorId,
};
