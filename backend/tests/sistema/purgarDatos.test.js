require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');

const prisma = require('../../src/config/prisma');
const sistemaService = require('../../src/modules/sistema/sistema.service');

/**
 * Pruebas de las validaciones de `purgarDatos` — la frase de confirmación y
 * la contraseña. Deliberadamente NO se prueba aquí el camino que sí borra
 * datos: esa es la operación más destructiva del sistema y corre contra la
 * misma base de datos de desarrollo que el resto de la suite (que corre en
 * paralelo), así que ejecutarla aquí podría borrar datos de otro test o
 * reales a mitad de una corrida de `npm test`.
 *
 * El camino que sí purga se prueba por separado y a demanda en
 * `purgarDatosDestructivo.manual.js` (no calza con el patrón `*.test.js`
 * a propósito, para que `npm test` nunca lo dispare solo).
 */

const SUFIJO = `test-purgar-validaciones-${Date.now()}`;
const PASSWORD_ADMIN = 'clave-admin-123';
let admin;

test.before(async () => {
  admin = await prisma.usuario.create({
    data: {
      email: `admin-${SUFIJO}@test.local`,
      password: await bcrypt.hash(PASSWORD_ADMIN, 10),
      rol: 'ADMINISTRADOR',
    },
  });
});

test.after(async () => {
  await prisma.usuario.deleteMany({ where: { id: admin.id } });
  await prisma.$disconnect();
});

test('rechaza si la frase de confirmación no es exacta (mayúsculas, espacios, etc.)', async () => {
  for (const confirmacion of ['eliminar todo', 'ELIMINAR TODO ', 'Eliminar Todo', '']) {
    const resultado = await sistemaService.purgarDatos(admin.id, { confirmacion, password: PASSWORD_ADMIN });
    assert.equal(resultado.error, 'CONFIRMACION_INVALIDA', `no debió aceptar "${confirmacion}"`);
  }
});

test('rechaza si la contraseña no coincide, aunque la frase sea correcta', async () => {
  const resultado = await sistemaService.purgarDatos(admin.id, {
    confirmacion: 'ELIMINAR TODO',
    password: 'clave-incorrecta',
  });
  assert.equal(resultado.error, 'PASSWORD_INVALIDA');
});

test('rechaza si no se envía contraseña', async () => {
  const resultado = await sistemaService.purgarDatos(admin.id, {
    confirmacion: 'ELIMINAR TODO',
    password: '',
  });
  assert.equal(resultado.error, 'PASSWORD_INVALIDA');
});

