require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');

const prisma = require('../../src/config/prisma');
const authService = require('../../src/modules/auth/auth.service');

/**
 * Pruebas de integración de auth contra la base de datos real.
 */

const SUFIJO = `test-auth-${Date.now()}`;
let usuario;
const PASSWORD_INICIAL = 'clave-inicial-123';

test.before(async () => {
  const bcrypt = require('bcrypt');
  usuario = await prisma.usuario.create({
    data: {
      email: `cliente-${SUFIJO}@test.local`,
      password: await bcrypt.hash(PASSWORD_INICIAL, 10),
      rol: 'CLIENTE',
    },
  });
});

test.after(async () => {
  await prisma.usuario.delete({ where: { id: usuario.id } });
  await prisma.$disconnect();
});

test('registrarAdmin: crea un administrador nuevo aunque ya existan otros usuarios (multi-tenant)', async () => {
  const { resultado } = await authService.registrarAdmin({
    email: `nuevo-admin-${SUFIJO}@test.local`,
    password: 'algunaClave123',
  });
  assert.ok(resultado.token);
  assert.equal(resultado.usuario.rol, 'ADMINISTRADOR');

  await prisma.usuario.delete({ where: { id: resultado.usuario.id } });
});

test('registrarAdmin: rechaza un email duplicado', async () => {
  await assert.rejects(
    () => authService.registrarAdmin({ email: usuario.email, password: 'algunaClave123' }),
    (error) => error.code === 'P2002'
  );
});

test('cambiarPassword: rechaza si la contraseña actual no coincide', async () => {
  const { error } = await authService.cambiarPassword(usuario.id, {
    passwordActual: 'contraseña-incorrecta',
    passwordNueva: 'nuevaClave456',
  });
  assert.equal(error, 'PASSWORD_ACTUAL_INVALIDA');
});

test('cambiarPassword: actualiza la contraseña y permite loguear con la nueva', async () => {
  const { error } = await authService.cambiarPassword(usuario.id, {
    passwordActual: PASSWORD_INICIAL,
    passwordNueva: 'nuevaClave456',
  });
  assert.equal(error, undefined);

  const conNueva = await authService.login(usuario.email, 'nuevaClave456');
  assert.ok(conNueva);
  assert.equal(conNueva.usuario.id, usuario.id);

  const conVieja = await authService.login(usuario.email, PASSWORD_INICIAL);
  assert.equal(conVieja, null);
});
