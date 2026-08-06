require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');

const prisma = require('../../src/config/prisma');
const notificacionesService = require('../../src/modules/notificaciones/notificaciones.service');
const pushService = require('../../src/modules/notificaciones/push.service');

/**
 * Pruebas de registro de tokens de push y de que `enviarPush` sea
 * verdaderamente best-effort: nunca debe reventar la operación que lo
 * disparó, ni siquiera si Expo está caído o el token ya no sirve.
 */

const SUFIJO = `test-push-${Date.now()}`;
let usuario;

test.before(async () => {
  usuario = await prisma.usuario.create({
    data: { email: `push-${SUFIJO}@test.local`, password: 'x', rol: 'ADMINISTRADOR' },
  });
});

test.after(async () => {
  await prisma.usuario.deleteMany({ where: { id: usuario.id } });
  await prisma.$disconnect();
});

test('registrarPushToken crea el token para el usuario', async () => {
  const token = `ExponentPushToken[${SUFIJO}-1]`;
  await notificacionesService.registrarPushToken(usuario.id, token);

  const guardado = await prisma.pushToken.findUnique({ where: { token } });
  assert.ok(guardado);
  assert.equal(guardado.usuarioId, usuario.id);
});

test('registrar el mismo token dos veces no duplica la fila (upsert)', async () => {
  const token = `ExponentPushToken[${SUFIJO}-2]`;
  await notificacionesService.registrarPushToken(usuario.id, token);
  await notificacionesService.registrarPushToken(usuario.id, token);

  const filas = await prisma.pushToken.findMany({ where: { token } });
  assert.equal(filas.length, 1);
});

test('registrar un token que ya era de otro usuario lo reasigna', async () => {
  const otro = await prisma.usuario.create({
    data: { email: `push-otro-${SUFIJO}@test.local`, password: 'x', rol: 'CLIENTE' },
  });
  const token = `ExponentPushToken[${SUFIJO}-3]`;

  try {
    await notificacionesService.registrarPushToken(usuario.id, token);
    await notificacionesService.registrarPushToken(otro.id, token);

    const guardado = await prisma.pushToken.findUnique({ where: { token } });
    assert.equal(guardado.usuarioId, otro.id);
  } finally {
    await prisma.usuario.delete({ where: { id: otro.id } });
  }
});

test('enviarPush no revienta si el usuario no tiene ningún token registrado', async () => {
  const sinToken = await prisma.usuario.create({
    data: { email: `push-sin-token-${SUFIJO}@test.local`, password: 'x', rol: 'CLIENTE' },
  });
  try {
    await assert.doesNotReject(() => pushService.enviarPush(sinToken.id, { titulo: 'x', mensaje: 'y' }));
  } finally {
    await prisma.usuario.delete({ where: { id: sinToken.id } });
  }
});

test('enviarPush no revienta si la llamada a Expo falla', async () => {
  // Usuario propio: `enviarPush` manda UN mensaje por cada token que tenga el
  // usuario, así que si `usuario` ya acumuló tokens de pruebas anteriores el
  // mock de fetch (que solo devuelve un ticket) no calzaría con la cantidad real.
  const propio = await prisma.usuario.create({
    data: { email: `push-falla-${SUFIJO}@test.local`, password: 'x', rol: 'CLIENTE' },
  });
  const token = `ExponentPushToken[${SUFIJO}-4]`;
  await notificacionesService.registrarPushToken(propio.id, token);

  const fetchOriginal = global.fetch;
  global.fetch = async () => {
    throw new Error('Expo no responde (simulado)');
  };
  try {
    await assert.doesNotReject(() => pushService.enviarPush(propio.id, { titulo: 'x', mensaje: 'y' }));
  } finally {
    global.fetch = fetchOriginal;
    await prisma.usuario.delete({ where: { id: propio.id } });
  }
});

test('enviarPush borra el token si Expo dice que el dispositivo ya no existe', async () => {
  const propio = await prisma.usuario.create({
    data: { email: `push-invalido-${SUFIJO}@test.local`, password: 'x', rol: 'CLIENTE' },
  });
  const token = `ExponentPushToken[${SUFIJO}-5]`;
  await notificacionesService.registrarPushToken(propio.id, token);

  const fetchOriginal = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }] }),
  });
  try {
    await pushService.enviarPush(propio.id, { titulo: 'x', mensaje: 'y' });
    const sigueExistiendo = await prisma.pushToken.findUnique({ where: { token } });
    assert.equal(sigueExistiendo, null);
  } finally {
    global.fetch = fetchOriginal;
    await prisma.usuario.deleteMany({ where: { id: propio.id } });
  }
});
