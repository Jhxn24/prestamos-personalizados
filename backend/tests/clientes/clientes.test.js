require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');

const prisma = require('../../src/config/prisma');
const clientesService = require('../../src/modules/clientes/clientes.service');

/**
 * Pruebas de integración de clientes contra la base de datos real.
 *
 * Foco: el acceso a la app (Usuario asociado) es OPCIONAL — el administrador
 * puede crear un cliente sin cuenta y agregarle una después.
 */

const SUFIJO = `test-clientes-${Date.now()}`;
let admin;
const clientesCreados = [];

test.before(async () => {
  admin = await prisma.usuario.create({
    data: { email: `admin-${SUFIJO}@test.local`, password: 'x', rol: 'ADMINISTRADOR' },
  });
});

test.after(async () => {
  for (const cliente of clientesCreados) {
    const actual = await prisma.cliente.findUnique({ where: { id: cliente.id } });
    if (!actual) continue;
    await prisma.cliente.delete({ where: { id: cliente.id } });
    if (actual.usuarioId) {
      await prisma.usuario.delete({ where: { id: actual.usuarioId } });
    }
  }
  await prisma.usuario.delete({ where: { id: admin.id } });
  await prisma.$disconnect();
});

test('crearCliente sin email/password deja al cliente sin cuenta de acceso', async () => {
  const cliente = await clientesService.crearCliente(
    { nombre: 'Sin', apellido: 'Cuenta', documento: `${SUFIJO}-1` },
    admin.id
  );
  clientesCreados.push(cliente);

  assert.equal(cliente.usuarioId, null);
  assert.equal(cliente.usuario, null);
});

test('crearCliente con email y password crea también la cuenta de acceso', async () => {
  const cliente = await clientesService.crearCliente(
    {
      nombre: 'Con',
      apellido: 'Cuenta',
      documento: `${SUFIJO}-2`,
      email: `con-cuenta-${SUFIJO}@test.local`,
      password: 'clave123',
    },
    admin.id
  );
  clientesCreados.push(cliente);

  assert.ok(cliente.usuarioId);
  assert.equal(cliente.usuario.email, `con-cuenta-${SUFIJO}@test.local`);
});

test('generarAccesoCliente agrega una cuenta a un cliente que no tenía', async () => {
  const cliente = await clientesService.crearCliente(
    { nombre: 'Le', apellido: 'Agregan', documento: `${SUFIJO}-3` },
    admin.id
  );
  clientesCreados.push(cliente);
  assert.equal(cliente.usuarioId, null);

  const resultado = await clientesService.generarAccesoCliente(
    cliente.id,
    { email: `le-agregan-${SUFIJO}@test.local`, password: 'clave123' },
    admin.id
  );

  assert.equal(resultado.error, undefined);
  assert.ok(resultado.cliente.usuarioId);
  assert.equal(resultado.cliente.usuario.email, `le-agregan-${SUFIJO}@test.local`);
});

test('generarAccesoCliente falla si el cliente ya tiene una cuenta', async () => {
  const cliente = await clientesService.crearCliente(
    {
      nombre: 'Ya',
      apellido: 'Tiene',
      documento: `${SUFIJO}-4`,
      email: `ya-tiene-${SUFIJO}@test.local`,
      password: 'clave123',
    },
    admin.id
  );
  clientesCreados.push(cliente);

  const resultado = await clientesService.generarAccesoCliente(
    cliente.id,
    { email: `otro-email-${SUFIJO}@test.local`, password: 'clave123' },
    admin.id
  );

  assert.equal(resultado.error, 'CLIENTE_YA_TIENE_ACCESO');
});

test('generarAccesoCliente falla si el cliente no existe', async () => {
  const resultado = await clientesService.generarAccesoCliente(
    '00000000-0000-0000-0000-000000000000',
    { email: `nadie-${SUFIJO}@test.local`, password: 'clave123' },
    admin.id
  );

  assert.equal(resultado.error, 'CLIENTE_NO_ENCONTRADO');
});

test('desactivarCliente no revienta con un cliente sin cuenta de acceso', async () => {
  const cliente = await clientesService.crearCliente(
    { nombre: 'Sin', apellido: 'CuentaDesactivar', documento: `${SUFIJO}-5` },
    admin.id
  );
  clientesCreados.push(cliente);

  const { cliente: desactivado } = await clientesService.desactivarCliente(cliente.id, admin.id);
  assert.equal(desactivado.activo, false);
});
