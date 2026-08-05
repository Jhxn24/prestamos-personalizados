function notificacionDTO(notificacion) {
  return {
    id: notificacion.id,
    tipo: notificacion.tipo,
    titulo: notificacion.titulo,
    mensaje: notificacion.mensaje,
    leida: notificacion.leida,
    prestamoId: notificacion.prestamoId,
    cuotaId: notificacion.cuotaId,
    pagoId: notificacion.pagoId,
    createdAt: notificacion.createdAt,
  };
}

module.exports = { notificacionDTO };
