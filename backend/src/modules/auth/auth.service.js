const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/prisma');

const TOKEN_EXPIRATION = '8h';

async function login(email, password) {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario || !usuario.activo) {
    return null;
  }

  const passwordValida = await bcrypt.compare(password, usuario.password);
  if (!passwordValida) {
    return null;
  }

  const token = jwt.sign({ sub: usuario.id, rol: usuario.rol }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_EXPIRATION,
  });

  return {
    token,
    usuario: { id: usuario.id, email: usuario.email, rol: usuario.rol },
  };
}

module.exports = { login };
