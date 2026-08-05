require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');

const prisma = require('../../src/config/prisma');
const authService = require('../../src/modules/auth/auth.service');

/**
 * Pruebas de integración de auth contra la base de datos real. No se prueba
 * el camino "true" de setupRequerido/registrarPrimerAdmin: eso exigiría una
 * base de datos vacía, y vaciarla sería destructivo sobre datos reales de
 * desarrollo. Se prueba en cambio que la vía se cierra en cuanto ya existe
 * un usuario (que siempre es el caso en este entorno, por el admin sembrado).
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

test('setupRequerido: es false porque ya existe al menos un usuario en este entorno', async () => {
  assert.equal(await authService.setupRequerido(), false);
});

test('registrarPrimerAdmin: se rechaza porque ya existe al menos un usuario', async () => {
  const { resultado, error } = await authService.registrarPrimerAdmin({
    email: `deberia-fallar-${SUFIJO}@test.local`,
    password: 'algunaClave123',
  });
  assert.equal(error, 'SETUP_YA_REALIZADO');
  assert.equal(resultado, undefined);

  const creado = await prisma.usuario.findUnique({
    where: { email: `deberia-fallar-${SUFIJO}@test.local` },
  });
  assert.equal(creado, null);
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
