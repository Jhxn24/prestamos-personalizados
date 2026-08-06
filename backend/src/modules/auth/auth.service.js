const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/prisma');

const TOKEN_EXPIRATION = '8h';
const SALT_ROUNDS = 10;

function emitirToken(usuario) {
  const token = jwt.sign({ sub: usuario.id, rol: usuario.rol }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_EXPIRATION,
  });
  return {
    token,
    usuario: { id: usuario.id, email: usuario.email, rol: usuario.rol },
  };
}

async function login(email, password) {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario || !usuario.activo) {
    return null;
  }

  const passwordValida = await bcrypt.compare(password, usuario.password);
  if (!passwordValida) {
    return null;
  }

  return emitirToken(usuario);
}

/**
 * Registro de administrador (multi-tenant): siempre abierto, sin límite de
 * cuántos puedan existir. Cada administrador arranca con su propia cartera
 * vacía, aislada de la de los demás.
 */
async function registrarAdmin({ email, password }) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const usuario = await prisma.usuario.create({
    data: { email, password: passwordHash, rol: 'ADMINISTRADOR' },
  });

  return { resultado: emitirToken(usuario) };
}

/** Cualquier usuario autenticado cambia su propia contraseña (requiere la actual). */
async function cambiarPassword(usuarioId, { passwordActual, passwordNueva }) {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) {
    return { error: 'USUARIO_NO_ENCONTRADO' };
  }

  const passwordValida = await bcrypt.compare(passwordActual, usuario.password);
  if (!passwordValida) {
    return { error: 'PASSWORD_ACTUAL_INVALIDA' };
  }

  const nuevoHash = await bcrypt.hash(passwordNueva, SALT_ROUNDS);
  await prisma.usuario.update({ where: { id: usuarioId }, data: { password: nuevoHash } });
  return {};
}

module.exports = { login, registrarAdmin, cambiarPassword };
