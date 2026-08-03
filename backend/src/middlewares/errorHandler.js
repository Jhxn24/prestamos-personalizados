const { Prisma } = require('@prisma/client');
const { ErrorMotorCalculo } = require('../modules/motor-calculo');

function errorHandler(err, req, res, next) {
  // Condiciones de préstamo inválidas: es culpa del dato enviado, no del sistema.
  if (err instanceof ErrorMotorCalculo) {
    return res.status(400).json({ error: err.message });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: `Ya existe un registro con ese ${err.meta?.target}` });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
  }

  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = errorHandler;
