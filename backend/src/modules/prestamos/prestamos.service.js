const prisma = require('../../config/prisma');
const { generarCronograma, ErrorMotorCalculo } = require('../motor-calculo');
const auditoriaService = require('../auditoria/auditoria.service');

const INCLUDE_CRONOGRAMA = {
  cuotas: { orderBy: { numero: 'asc' } },
  cliente: { select: { id: true, nombre: true, apellido: true, documento: true } },
};

/**
 * Normaliza la entrada del API al contrato que espera el motor de cálculo
 * (fechas como Date, enteros como Number).
 */
function parametrosDelMotor(datos) {
  return {
    capital: datos.capital,
    tasaInteres: datos.tasaInteres,
    tipoInteres: datos.tipoInteres,
    frecuenciaPago: datos.frecuenciaPago,
    diasPersonalizados:
      datos.diasPersonalizados === undefined || datos.diasPersonalizados === null
        ? undefined
        : Number(datos.diasPersonalizados),
    numeroCuotas: Number(datos.numeroCuotas),
    modalidad: datos.modalidad,
    fechaDesembolso: datos.fechaDesembolso ? new Date(datos.fechaDesembolso) : new Date(),
  };
}

/**
 * Traduce el alcance del usuario (RNF-05 multi-tenant) al filtro de Prisma
 * sobre Prestamo: un cliente ve solo su propio préstamo (`clienteId` es un
 * campo directo); un administrador ve toda su cartera vía la relación con
 * Cliente.
 */
function filtroAlcance({ administradorId, clienteId } = {}) {
  if (clienteId) return { clienteId };
  if (administradorId) return { cliente: { administradorId } };
  return undefined;
}

function cuotasParaPersistir(cuotas) {
  return cuotas.map((cuota) => ({
    numero: cuota.numero,
    fechaVencimiento: cuota.fechaVencimiento,
    capital: cuota.capital.toFixed(2),
    interes: cuota.interes.toFixed(2),
    total: cuota.total.toFixed(2),
    saldoCapital: cuota.saldoCapital.toFixed(2),
  }));
}

/**
 * Simula un cronograma sin persistir nada (RF-09: permite al administrador ver
 * el efecto de un ajuste antes de comprometerlo).
 */
function simular(datos) {
  const parametros = parametrosDelMotor(datos);
  const { cuotas, resumen, tasaPorCuota } = generarCronograma(parametros);

  return {
    tasaPorCuota: tasaPorCuota.times(100).toDecimalPlaces(6).toString(),
    resumen: {
      totalCapital: resumen.totalCapital.toFixed(2),
      totalInteres: resumen.totalInteres.toFixed(2),
      totalAPagar: resumen.totalAPagar.toFixed(2),
      numeroCuotas: resumen.numeroCuotas,
    },
    cuotas: cuotasParaPersistir(cuotas),
  };
}

/**
 * Registra un préstamo y su cronograma inicial (RF-05, RF-06, RF-07, RF-18).
 */
async function crearPrestamo(datos, usuarioId) {
  const cliente = await prisma.cliente.findFirst({
    where: { id: datos.clienteId, administradorId: usuarioId },
  });
  if (!cliente) {
    throw new ErrorMotorCalculo('El cliente indicado no existe');
  }
  if (!cliente.activo) {
    throw new ErrorMotorCalculo('No se puede registrar un préstamo a un cliente desactivado');
  }

  const parametros = parametrosDelMotor(datos);
  const { cuotas } = generarCronograma(parametros);

  const prestamo = await prisma.prestamo.create({
    data: {
      clienteId: datos.clienteId,
      capital: parametros.capital.toString(),
      capitalPendiente: parametros.capital.toString(),
      tasaInteres: parametros.tasaInteres.toString(),
      tipoInteres: parametros.tipoInteres,
      frecuenciaPago: parametros.frecuenciaPago,
      diasPersonalizados: parametros.diasPersonalizados ?? null,
      numeroCuotas: parametros.numeroCuotas,
      modalidad: parametros.modalidad,
      fechaDesembolso: parametros.fechaDesembolso,
      // Política de atraso pactada (RF-16).
      politicaMora: datos.politicaMora ?? 'NINGUNA',
      tasaMora: (datos.tasaMora ?? 0).toString(),
      diasGracia: Number(datos.diasGracia ?? 0),
      cuotas: { create: cuotasParaPersistir(cuotas) },
    },
    include: INCLUDE_CRONOGRAMA,
  });

  await auditoriaService.registrar({
    usuarioId,
    entidad: 'PRESTAMO',
    entidadId: prestamo.id,
    accion: 'CREAR',
    detalle: `Préstamo registrado: capital S/ ${parametros.capital.toString()}, ${parametros.numeroCuotas} cuotas, modalidad ${parametros.modalidad}.`,
  });

  return prestamo;
}

function listarPrestamos(alcance = {}) {
  return prisma.prestamo.findMany({
    where: filtroAlcance(alcance),
    include: INCLUDE_CRONOGRAMA,
    orderBy: { createdAt: 'desc' },
  });
}

function obtenerPrestamoPorId(id, alcance = {}) {
  return prisma.prestamo.findFirst({ where: { id, ...filtroAlcance(alcance) }, include: INCLUDE_CRONOGRAMA });
}

async function obtenerCronograma(id, alcance = {}) {
  const prestamo = await prisma.prestamo.findFirst({
    where: { id, ...filtroAlcance(alcance) },
    include: { cuotas: { orderBy: { numero: 'asc' } } },
  });
  return prestamo?.cuotas ?? null;
}

/**
 * Recalcula un préstamo vigente con nuevas condiciones (RF-09).
 *
 * Reemplaza el cronograma pendiente por completo. Se apoya en una transacción
 * porque borrar las cuotas viejas y crear las nuevas debe ser atómico: un
 * préstamo sin cronograma es un estado inválido para el negocio.
 */
async function recalcularPrestamo(id, ajustes, usuarioId) {
  const prestamo = await prisma.prestamo.findFirst({
    where: { id, cliente: { administradorId: usuarioId } },
    include: { cuotas: true },
  });
  if (!prestamo) {
    return null;
  }
  if (prestamo.estado !== 'ACTIVO') {
    throw new ErrorMotorCalculo(`Solo se puede recalcular un préstamo ACTIVO (estado actual: ${prestamo.estado})`);
  }

  const tienePagos = prestamo.cuotas.some((cuota) => Number(cuota.montoPagado) > 0);
  if (tienePagos) {
    throw new ErrorMotorCalculo(
      'Este préstamo ya tiene cuotas con pagos registrados; usa refinanciamiento en vez de recalcular'
    );
  }

  const parametros = parametrosDelMotor({
    capital: ajustes.capital ?? prestamo.capital.toString(),
    tasaInteres: ajustes.tasaInteres ?? prestamo.tasaInteres.toString(),
    tipoInteres: ajustes.tipoInteres ?? prestamo.tipoInteres,
    frecuenciaPago: ajustes.frecuenciaPago ?? prestamo.frecuenciaPago,
    diasPersonalizados: ajustes.diasPersonalizados ?? prestamo.diasPersonalizados,
    numeroCuotas: ajustes.numeroCuotas ?? prestamo.numeroCuotas,
    modalidad: ajustes.modalidad ?? prestamo.modalidad,
    fechaDesembolso: ajustes.fechaDesembolso ?? prestamo.fechaDesembolso,
  });

  const { cuotas } = generarCronograma(parametros);

  const actualizado = await prisma.$transaction(async (tx) => {
    await tx.cuota.deleteMany({ where: { prestamoId: id } });

    return tx.prestamo.update({
      where: { id },
      data: {
        capital: parametros.capital.toString(),
        capitalPendiente: parametros.capital.toString(),
        tasaInteres: parametros.tasaInteres.toString(),
        tipoInteres: parametros.tipoInteres,
        frecuenciaPago: parametros.frecuenciaPago,
        diasPersonalizados: parametros.diasPersonalizados ?? null,
        numeroCuotas: parametros.numeroCuotas,
        modalidad: parametros.modalidad,
        fechaDesembolso: parametros.fechaDesembolso,
        cuotas: { create: cuotasParaPersistir(cuotas) },
      },
      include: INCLUDE_CRONOGRAMA,
    });
  });

  await auditoriaService.registrar({
    usuarioId,
    entidad: 'PRESTAMO',
    entidadId: id,
    accion: 'RECALCULAR',
    detalle: `Préstamo recalculado: capital S/ ${parametros.capital.toString()}, ${parametros.numeroCuotas} cuotas.`,
  });

  return actualizado;
}

/**
 * Refinancia un préstamo (RF-08): cierra el original y crea uno nuevo cuyo
 * capital es el saldo pendiente, con las condiciones que defina el administrador.
 */
async function refinanciarPrestamo(id, condiciones, usuarioId) {
  const original = await prisma.prestamo.findFirst({
    where: { id, cliente: { administradorId: usuarioId } },
  });
  if (!original) {
    return null;
  }
  if (original.estado !== 'ACTIVO') {
    throw new ErrorMotorCalculo(
      `Solo se puede refinanciar un préstamo ACTIVO (estado actual: ${original.estado})`
    );
  }

  const saldoPendiente = original.capitalPendiente;
  if (Number(saldoPendiente) <= 0) {
    throw new ErrorMotorCalculo('El préstamo no tiene saldo pendiente para refinanciar');
  }

  const parametros = parametrosDelMotor({
    // El capital del nuevo préstamo es el saldo que quedó del anterior.
    capital: condiciones.capital ?? saldoPendiente.toString(),
    tasaInteres: condiciones.tasaInteres ?? original.tasaInteres.toString(),
    tipoInteres: condiciones.tipoInteres ?? original.tipoInteres,
    frecuenciaPago: condiciones.frecuenciaPago ?? original.frecuenciaPago,
    diasPersonalizados: condiciones.diasPersonalizados ?? original.diasPersonalizados,
    numeroCuotas: condiciones.numeroCuotas ?? original.numeroCuotas,
    modalidad: condiciones.modalidad ?? original.modalidad,
    fechaDesembolso: condiciones.fechaDesembolso ?? new Date(),
  });

  const { cuotas } = generarCronograma(parametros);

  const nuevoPrestamo = await prisma.$transaction(async (tx) => {
    await tx.prestamo.update({ where: { id }, data: { estado: 'REFINANCIADO' } });

    return tx.prestamo.create({
      data: {
        clienteId: original.clienteId,
        prestamoOrigenId: original.id,
        capital: parametros.capital.toString(),
        capitalPendiente: parametros.capital.toString(),
        tasaInteres: parametros.tasaInteres.toString(),
        tipoInteres: parametros.tipoInteres,
        frecuenciaPago: parametros.frecuenciaPago,
        diasPersonalizados: parametros.diasPersonalizados ?? null,
        numeroCuotas: parametros.numeroCuotas,
        modalidad: parametros.modalidad,
        fechaDesembolso: parametros.fechaDesembolso,
        cuotas: { create: cuotasParaPersistir(cuotas) },
      },
      include: INCLUDE_CRONOGRAMA,
    });
  });

  await auditoriaService.registrar({
    usuarioId,
    entidad: 'PRESTAMO',
    entidadId: nuevoPrestamo.id,
    accion: 'REFINANCIAR',
    detalle: `Refinanciado desde el préstamo ${original.id}: nuevo capital S/ ${parametros.capital.toString()}, ${parametros.numeroCuotas} cuotas.`,
  });

  return nuevoPrestamo;
}

module.exports = {
  simular,
  crearPrestamo,
  listarPrestamos,
  obtenerPrestamoPorId,
  obtenerCronograma,
  recalcularPrestamo,
  refinanciarPrestamo,
};
