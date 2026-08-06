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

// Multi-tenant: registro de administrador siempre abierto (cada uno arranca
// con su propia cartera vacía).
async function registrarAdmin(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email y password son obligatorios' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const { resultado } = await authService.registrarAdmin({ email, password });
    res.status(201).json(resultado);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese email.' });
    }
    next(error);
  }
}

async function cambiarPassword(req, res, next) {
  try {
    const { passwordActual, passwordNueva } = req.body;
    if (!passwordActual || !passwordNueva) {
      return res.status(400).json({ error: 'passwordActual y passwordNueva son obligatorios' });
    }
    if (passwordNueva.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    const { error } = await authService.cambiarPassword(req.usuario.id, { passwordActual, passwordNueva });
    if (error === 'PASSWORD_ACTUAL_INVALIDA') {
      return res.status(401).json({ error: 'La contraseña actual no es correcta' });
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

module.exports = { login, registrarAdmin, cambiarPassword };
