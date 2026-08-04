const { formatearMonto } = require('../../utils/dinero');

function reciboDTO(recibo) {
  if (!recibo) return null;
  return {
    numero: recibo.numero,
    monto: formatearMonto(recibo.monto),
    fechaEmision: recibo.fechaEmision,
  };
}

function cuotaResumenDTO(cuota) {
  if (!cuota) return null;
  return {
    id: cuota.id,
    numero: cuota.numero,
    estado: cuota.estado,
    total: formatearMonto(cuota.total),
    montoPagado: formatearMonto(cuota.montoPagado),
  };
}

function prestamoResumenDTO(prestamo) {
  if (!prestamo) return null;
  return {
    id: prestamo.id,
    clienteId: prestamo.clienteId,
    estado: prestamo.estado,
    capitalPendiente: formatearMonto(prestamo.capitalPendiente),
  };
}

/**
 * Shape público de un pago. Deja fuera registradoPorId/confirmadoPorId
 * (identificadores internos sin utilidad para el frontend sin un join que hoy
 * no existe) y createdAt/updatedAt, y formatea todos los montos a 2 decimales.
 */
function pagoDTO(pago) {
  return {
    id: pago.id,
    prestamoId: pago.prestamoId,
    cuotaId: pago.cuotaId,
    monto: formatearMonto(pago.monto),
    metodo: pago.metodo,
    estado: pago.estado,
    moraAplicada: formatearMonto(pago.moraAplicada),
    interesAplicado: formatearMonto(pago.interesAplicado),
    capitalAplicado: formatearMonto(pago.capitalAplicado),
    excedente: formatearMonto(pago.excedente),
    interesCondonado: formatearMonto(pago.interesCondonado),
    cuotasEliminadas: pago.cuotasEliminadas,
    politicaInteresAnticipado: pago.politicaInteresAnticipado,
    politicaAbonoExtraordinario: pago.politicaAbonoExtraordinario,
    comprobanteUrl: pago.comprobanteUrl,
    observaciones: pago.observaciones,
    motivoRechazo: pago.motivoRechazo,
    fechaPago: pago.fechaPago,
    fechaConfirmacion: pago.fechaConfirmacion,
    recibo: reciboDTO(pago.recibo),
    cuota: cuotaResumenDTO(pago.cuota),
    prestamo: prestamoResumenDTO(pago.prestamo),
  };
}

module.exports = { pagoDTO };
