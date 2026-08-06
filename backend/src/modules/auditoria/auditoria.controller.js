const auditoriaService = require('./auditoria.service');
const { registroAuditoriaDTO } = require('./auditoria.dto');

// RF-36: bitácora de cambios relevantes, filtrable por entidad/usuario/fecha.
async function listar(req, res, next) {
  try {
    const { entidad, entidadId, desde, hasta } = req.query;
    // Cada admin ve solo su propia bitácora: usuarioId siempre es el actor
    // autenticado, nunca un valor arbitrario tomado de la query string.
    const registros = await auditoriaService.listar({
      entidad,
      entidadId,
      usuarioId: req.usuario.id,
      desde: desde ? new Date(desde) : undefined,
      hasta: hasta ? new Date(hasta) : undefined,
    });
    res.json(registros.map(registroAuditoriaDTO));
  } catch (error) {
    next(error);
  }
}

module.exports = { listar };
