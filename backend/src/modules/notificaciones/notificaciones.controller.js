const notificacionesService = require('./notificaciones.service');
const { notificacionDTO } = require('./notificaciones.dto');

// RF-26/27/28: cada usuario ve únicamente sus propias notificaciones (RNF-05).
async function listar(req, res, next) {
  try {
    const soloNoLeidas = req.query.noLeidas === 'true';
    const notificaciones = await notificacionesService.listar(req.usuario.id, { soloNoLeidas });
    res.json(notificaciones.map(notificacionDTO));
  } catch (error) {
    next(error);
  }
}

async function contador(req, res, next) {
  try {
    const noLeidas = await notificacionesService.contarNoLeidas(req.usuario.id);
    res.json({ noLeidas });
  } catch (error) {
    next(error);
  }
}

async function marcarLeida(req, res, next) {
  try {
    const actualizada = await notificacionesService.marcarLeida(req.params.id, req.usuario.id);
    if (!actualizada) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

async function marcarTodasLeidas(req, res, next) {
  try {
    await notificacionesService.marcarTodasLeidas(req.usuario.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

// Disparo manual del barrido diario (RF-26, RF-28): el job programado lo
// corre solo, pero el administrador puede forzarlo (backfill, pruebas, o si
// el proceso estuvo caído a la hora programada).
async function generar(req, res, next) {
  try {
    const fechaReferencia = req.body?.fechaReferencia ? new Date(req.body.fechaReferencia) : new Date();
    const [recordatorios, resumenes] = await Promise.all([
      notificacionesService.generarRecordatoriosVencimiento(fechaReferencia),
      notificacionesService.generarResumenAdmin(fechaReferencia),
    ]);
    res.json({ recordatoriosCreados: recordatorios, resumenesCreados: resumenes });
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, contador, marcarLeida, marcarTodasLeidas, generar };
