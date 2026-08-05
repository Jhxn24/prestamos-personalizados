const auditoriaService = require('./auditoria.service');
const { registroAuditoriaDTO } = require('./auditoria.dto');

// RF-36: bitácora de cambios relevantes, filtrable por entidad/usuario/fecha.
async function listar(req, res, next) {
  try {
    const { entidad, entidadId, usuarioId, desde, hasta } = req.query;
    const registros = await auditoriaService.listar({
      entidad,
      entidadId,
      usuarioId,
      desde: desde ? new Date(desde) : undefined,
      hasta: hasta ? new Date(hasta) : undefined,
    });
    res.json(registros.map(registroAuditoriaDTO));
  } catch (error) {
    next(error);
  }
}

module.exports = { listar };
