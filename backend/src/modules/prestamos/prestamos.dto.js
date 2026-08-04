const { formatearMonto, formatearTasa } = require('../../utils/dinero');

function clienteResumenDTO(cliente) {
  if (!cliente) return null;
  return {
    id: cliente.id,
    nombre: cliente.nombre,
    apellido: cliente.apellido,
    documento: cliente.documento,
  };
}

function cuotaDTO(cuota) {
  return {
    id: cuota.id,
    numero: cuota.numero,
    fechaVencimiento: cuota.fechaVencimiento,
    capital: formatearMonto(cuota.capital),
    interes: formatearMonto(cuota.interes),
    total: formatearMonto(cuota.total),
    saldoCapital: formatearMonto(cuota.saldoCapital),
    capitalPagado: formatearMonto(cuota.capitalPagado),
    interesPagado: formatearMonto(cuota.interesPagado),
    montoPagado: formatearMonto(cuota.montoPagado),
    mora: formatearMonto(cuota.mora),
    moraPagada: formatearMonto(cuota.moraPagada),
    diasAtraso: cuota.diasAtraso,
    extensionAplicada: cuota.extensionAplicada,
    estado: cuota.estado,
  };
}

/**
 * Shape público de un préstamo. Deja fuera bookkeeping interno que no le sirve
 * al frontend (moraCalculadaEn, createdAt/updatedAt) y formatea dinero y tasas
 * de forma consistente en vez de exponer el Decimal de Prisma tal cual.
 */
function prestamoDTO(prestamo) {
  return {
    id: prestamo.id,
    cliente: clienteResumenDTO(prestamo.cliente),
    capital: formatearMonto(prestamo.capital),
    capitalPendiente: formatearMonto(prestamo.capitalPendiente),
    interesAcumulado: formatearMonto(prestamo.interesAcumulado),
    moraAcumulada: formatearMonto(prestamo.moraAcumulada),
    tasaInteres: formatearTasa(prestamo.tasaInteres),
    tipoInteres: prestamo.tipoInteres,
    frecuenciaPago: prestamo.frecuenciaPago,
    diasPersonalizados: prestamo.diasPersonalizados,
    numeroCuotas: prestamo.numeroCuotas,
    modalidad: prestamo.modalidad,
    fechaDesembolso: prestamo.fechaDesembolso,
    estado: prestamo.estado,
    politicaMora: prestamo.politicaMora,
    tasaMora: formatearTasa(prestamo.tasaMora),
    diasGracia: prestamo.diasGracia,
    prestamoOrigenId: prestamo.prestamoOrigenId,
    cuotas: prestamo.cuotas ? prestamo.cuotas.map(cuotaDTO) : undefined,
  };
}

module.exports = { prestamoDTO, cuotaDTO };
