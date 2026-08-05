function registroAuditoriaDTO(registro) {
  return {
    id: registro.id,
    entidad: registro.entidad,
    entidadId: registro.entidadId,
    accion: registro.accion,
    detalle: registro.detalle,
    usuario: { email: registro.usuario.email, rol: registro.usuario.rol },
    createdAt: registro.createdAt,
  };
}

module.exports = { registroAuditoriaDTO };
