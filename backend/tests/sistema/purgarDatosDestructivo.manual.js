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
 * borra todos los clientes y préstamos de LA CARTERA DEL ADMINISTRADOR que lo
 * ejecuta (multi-tenant: nunca toca la cartera de otro admin). No corre como
 * parte de `npm test` (el nombre no calza con `tests/**\/*.test.js`) y no debe
 * ejecutarse contra ninguna base con datos reales.
 *
 * Ejecutar explícitamente y a propósito con:
 *   node --test tests/sistema/purgarDatosDestructivo.manual.js
 * apuntando DATABASE_URL a una base descartable.
 */

const SUFIJO = `test-purgar-destructivo-${Date.now()}`;
const PASSWORD_ADMIN = 'clave-admin-123';
let admin;
let otroAdmin;

test.before(async () => {
  admin = await prisma.usuario.create({
    data: {
      email: `admin-${SUFIJO}@test.local`,
      password: await bcrypt.hash(PASSWORD_ADMIN, 10),
      rol: 'ADMINISTRADOR',
    },
  });
  otroAdmin = await prisma.usuario.create({
    data: {
      email: `otro-admin-${SUFIJO}@test.local`,
      password: 'x',
      rol: 'ADMINISTRADOR',
    },
  });
});

test.after(async () => {
  await prisma.usuario.deleteMany({ where: { id: { in: [admin.id, otroAdmin.id] } } });
  await prisma.$disconnect();
});

test('purgarDatos borra solo la cartera de quien la ejecuta y deja constancia en la bitácora', async () => {
  const cliente = await prisma.cliente.create({
    data: {
      nombre: 'Test',
      apellido: 'Purgar',
      documento: `${SUFIJO}-cliente`,
      administrador: { connect: { id: admin.id } },
      usuario: {
        create: { email: `cliente-${SUFIJO}@test.local`, password: 'x', rol: 'CLIENTE' },
      },
    },
    include: { usuario: true },
  });

  // Cliente de OTRO administrador: debe sobrevivir intacto a la purga de `admin`.
  const clienteAjeno = await prisma.cliente.create({
    data: { nombre: 'Ajeno', apellido: 'Purgar', documento: `${SUFIJO}-ajeno`, administradorId: otroAdmin.id },
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

  try {
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

    // el cliente de OTRO administrador no se toca
    assert.ok(await prisma.cliente.findUnique({ where: { id: clienteAjeno.id } }));

    // la bitácora sobrevive y registra la purga
    const registros = await auditoriaService.listar({ entidad: 'SISTEMA' });
    const registroPurga = registros.find((r) => r.accion === 'PURGAR' && r.usuarioId === admin.id);
    assert.ok(registroPurga, 'debe quedar un registro de auditoría de la purga');
    assert.match(registroPurga.detalle, /clientes/);
  } finally {
    await prisma.cliente.deleteMany({ where: { id: clienteAjeno.id } });
  }
});
