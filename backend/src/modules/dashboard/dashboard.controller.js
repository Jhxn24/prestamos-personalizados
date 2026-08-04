const prisma = require('../../config/prisma');
const dashboardService = require('./dashboard.service');

// RF-29 (administrador) / RF-30 (cliente): un solo endpoint, el rol decide la vista.
async function resumen(req, res, next) {
  try {
    if (req.usuario.rol === 'ADMINISTRADOR') {
      return res.json(await dashboardService.resumenAdministrador());
    }

    const cliente = await prisma.cliente.findUnique({ where: { usuarioId: req.usuario.id } });
    if (!cliente) {
      return res.status(404).json({ error: 'No hay un cliente asociado a este usuario' });
    }

    res.json(await dashboardService.resumenCliente(cliente.id));
  } catch (error) {
    next(error);
  }
}

module.exports = { resumen };
