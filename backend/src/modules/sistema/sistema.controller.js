const sistemaService = require('./sistema.service');

async function purgarDatos(req, res, next) {
  try {
    const { confirmacion, password } = req.body;
    if (!confirmacion || !password) {
      return res.status(400).json({ error: 'confirmacion y password son obligatorios' });
    }

    const { resultado, error } = await sistemaService.purgarDatos(req.usuario.id, {
      confirmacion,
      password,
    });

    if (error === 'CONFIRMACION_INVALIDA') {
      return res.status(400).json({ error: `Debes escribir "${sistemaService.FRASE_CONFIRMACION}" para confirmar` });
    }
    if (error === 'PASSWORD_INVALIDA') {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }
    if (error === 'USUARIO_NO_ENCONTRADO') {
      return res.status(401).json({ error: 'Sesión inválida' });
    }

    res.json(resultado);
  } catch (error) {
    next(error);
  }
}

module.exports = { purgarDatos };
