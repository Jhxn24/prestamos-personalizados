require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');

const prisma = require('../../src/config/prisma');
const sistemaService = require('../../src/modules/sistema/sistema.service');
const prestamosService = require('../../src/modules/prestamos/prestamos.service');
const pagosService = require('../../src/modules/pagos/pagos.service');
const auditoriaService = require('../../src/modules/auditoria/auditoria.service');

/**
 * ADVERTENCIA: este archivo SÍ ejecuta el borrado real de `purgarDatos` — que
 * borra TODOS los clientes y préstamos de la base de datos apuntada por
 * DATABASE_URL, sin importar quién los creó. No corre como parte de
 * `npm test` (el nombre no calza con `tests/**\/*.test.js`) y no debe
 * ejecutarse contra ninguna base con datos reales.
 *
 * Ejecutar explícitamente y a propósito con:
 *   node --test tests/sistema/purgarDatosDestructivo.manual.js
 * apuntando DATABASE_URL a una base descartable.
 */

const SUFIJO = `test-purgar-destructivo-${Date.now()}`;
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

test('purgarDatos borra clientes/préstamos/cuotas/pagos/cuentas y deja constancia en la bitácora', async () => {
  const cliente = await prisma.cliente.create({
    data: {
      nombre: 'Test',
      apellido: 'Purgar',
      documento: `${SUFIJO}-cliente`,
      usuario: {
        create: { email: `cliente-${SUFIJO}@test.local`, password: 'x', rol: 'CLIENTE' },
      },
    },
    include: { usuario: true },
  });

  const prestamo = await prestamosService.crearPrestamo(
    {
      clienteId: cliente.id,
      capital: 1000,
      tasaInteres: 5,
      tipoInteres: 'MENSUAL',
      frecuenciaPago: 'MENSUAL',
      numeroCuotas: 2,
      modalidad: 'INTERES_FIJO',
      fechaDesembolso: new Date(),
    },
    admin.id
  );

  const [cuota1] = await prisma.cuota.findMany({ where: { prestamoId: prestamo.id }, orderBy: { numero: 'asc' } });
  await pagosService.registrarPago({ cuotaId: cuota1.id, monto: 50 }, admin.id);

  const usuarioClienteId = cliente.usuarioId;

  const { resultado, error } = await sistemaService.purgarDatos(admin.id, {
    confirmacion: 'ELIMINAR TODO',
    password: PASSWORD_ADMIN,
  });

  assert.equal(error, undefined);
  assert.ok(resultado.clientes >= 1);
  assert.ok(resultado.prestamos >= 1);
  assert.ok(resultado.pagos >= 1);
  assert.ok(resultado.cuentasCliente >= 1);

  assert.equal(await prisma.cliente.findUnique({ where: { id: cliente.id } }), null);
  assert.equal(await prisma.prestamo.findUnique({ where: { id: prestamo.id } }), null);
  assert.equal(await prisma.cuota.findFirst({ where: { prestamoId: prestamo.id } }), null);
  assert.equal(await prisma.usuario.findUnique({ where: { id: usuarioClienteId } }), null);

  // el propio administrador sobrevive
  assert.ok(await prisma.usuario.findUnique({ where: { id: admin.id } }));

  // la bitácora sobrevive y registra la purga
  const registros = await auditoriaService.listar({ entidad: 'SISTEMA' });
  const registroPurga = registros.find((r) => r.accion === 'PURGAR' && r.usuarioId === admin.id);
  assert.ok(registroPurga, 'debe quedar un registro de auditoría de la purga');
  assert.match(registroPurga.detalle, /clientes/);
});
