const authService = require('./auth.service');

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email y password son obligatorios' });
    }

    const resultado = await authService.login(email, password);
    if (!resultado) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    res.json(resultado);
  } catch (error) {
    next(error);
  }
}

module.exports = { login };
