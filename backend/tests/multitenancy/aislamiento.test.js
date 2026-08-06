require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');

const prisma = require('../../src/config/prisma');
const clientesService = require('../../src/modules/clientes/clientes.service');
const prestamosService = require('../../src/modules/prestamos/prestamos.service');
const pagosService = require('../../src/modules/pagos/pagos.service');
const dashboardService = require('../../src/modules/dashboard/dashboard.service');
const auditoriaService = require('../../src/modules/auditoria/auditoria.service');

/**
 * Multi-tenancy: dos administradores en la misma base de datos, cada uno con
 * su propia cartera. Nada de lo que hace/ve `adminA` debe filtrarse hacia
 * `adminB` ni viceversa — ni en listados, ni en accesos directos por id, ni
 * en el dashboard ni en la bitácora.
 */

const SUFIJO = `test-multitenancy-${Date.now()}`;

let adminA;
let adminB;
let clienteA;
let clienteB;
let prestamoA;
let prestamoB;
let pagoA;
let pagoB;

test.before(async () => {
  adminA = await prisma.usuario.create({
    data: { email: `admin-a-${SUFIJO}@test.local`, password: 'x', rol: 'ADMINISTRADOR' },
  });
  adminB = await prisma.usuario.create({
    data: { email: `admin-b-${SUFIJO}@test.local`, password: 'x', rol: 'ADMINISTRADOR' },
  });

  clienteA = await clientesService.crearCliente(
    { nombre: 'Cliente', apellido: 'DeA', documento: `${SUFIJO}-a` },
    adminA.id
  );
  clienteB = await clientesService.crearCliente(
    { nombre: 'Cliente', apellido: 'DeB', documento: `${SUFIJO}-b` },
    adminB.id
  );

  prestamoA = await prestamosService.crearPrestamo(
    {
      clienteId: clienteA.id,
      capital: 1000,
      tasaInteres: 5,
      tipoInteres: 'MENSUAL',
      frecuenciaPago: 'MENSUAL',
      numeroCuotas: 2,
      modalidad: 'INTERES_FIJO',
      fechaDesembolso: new Date(),
    },
    adminA.id
  );
  prestamoB = await prestamosService.crearPrestamo(
    {
      clienteId: clienteB.id,
      capital: 500,
      tasaInteres: 5,
      tipoInteres: 'MENSUAL',
      frecuenciaPago: 'MENSUAL',
      numeroCuotas: 2,
      modalidad: 'INTERES_FIJO',
      fechaDesembolso: new Date(),
    },
    adminB.id
  );

  const [cuotaA] = await prisma.cuota.findMany({ where: { prestamoId: prestamoA.id }, orderBy: { numero: 'asc' } });
  const [cuotaB] = await prisma.cuota.findMany({ where: { prestamoId: prestamoB.id }, orderBy: { numero: 'asc' } });

  ({ pago: pagoA } = await pagosService.registrarPago({ cuotaId: cuotaA.id, monto: 100 }, adminA.id));
  ({ pago: pagoB } = await pagosService.registrarPago({ cuotaId: cuotaB.id, monto: 50 }, adminB.id));
});

test.after(async () => {
  await prisma.prestamo.deleteMany({ where: { clienteId: { in: [clienteA.id, clienteB.id] } } });
  await prisma.cliente.deleteMany({ where: { id: { in: [clienteA.id, clienteB.id] } } });
  await prisma.usuario.deleteMany({ where: { id: { in: [adminA.id, adminB.id] } } });
  await prisma.$disconnect();
});

test('listarClientes: cada admin ve solo sus propios clientes', async () => {
  const deA = await clientesService.listarClientes(adminA.id);
  const deB = await clientesService.listarClientes(adminB.id);

  assert.ok(deA.some((c) => c.id === clienteA.id));
  assert.ok(!deA.some((c) => c.id === clienteB.id));
  assert.ok(deB.some((c) => c.id === clienteB.id));
  assert.ok(!deB.some((c) => c.id === clienteA.id));
});

test('obtenerClientePorId: acceder al cliente de otro admin da null (404 genérico)', async () => {
  assert.equal(await clientesService.obtenerClientePorId(clienteB.id, adminA.id), null);
  assert.ok(await clientesService.obtenerClientePorId(clienteA.id, adminA.id));
});

test('actualizarCliente/desactivarCliente: no se puede mutar el cliente de otro admin', async () => {
  const resultadoActualizar = await clientesService.actualizarCliente(
    clienteB.id,
    { telefono: '999' },
    adminA.id
  );
  assert.equal(resultadoActualizar.error, 'CLIENTE_NO_ENCONTRADO');

  const resultadoDesactivar = await clientesService.desactivarCliente(clienteB.id, adminA.id);
  assert.equal(resultadoDesactivar.error, 'CLIENTE_NO_ENCONTRADO');

  const clienteBIntacto = await prisma.cliente.findUnique({ where: { id: clienteB.id } });
  assert.equal(clienteBIntacto.activo, true);
});

test('crearPrestamo: no se puede crear un préstamo sobre el cliente de otro admin', async () => {
  await assert.rejects(
    () =>
      prestamosService.crearPrestamo(
        {
          clienteId: clienteB.id,
          capital: 100,
          tasaInteres: 5,
          tipoInteres: 'MENSUAL',
          frecuenciaPago: 'MENSUAL',
          numeroCuotas: 1,
          modalidad: 'INTERES_FIJO',
          fechaDesembolso: new Date(),
        },
        adminA.id
      ),
    /El cliente indicado no existe/
  );
});

test('listarPrestamos/obtenerPrestamoPorId: cada admin ve solo su propia cartera de préstamos', async () => {
  const deA = await prestamosService.listarPrestamos({ administradorId: adminA.id });
  assert.ok(deA.some((p) => p.id === prestamoA.id));
  assert.ok(!deA.some((p) => p.id === prestamoB.id));

  assert.equal(
    await prestamosService.obtenerPrestamoPorId(prestamoB.id, { administradorId: adminA.id }),
    null
  );
  assert.ok(await prestamosService.obtenerPrestamoPorId(prestamoA.id, { administradorId: adminA.id }));
});

test('registrarPago: no se puede pagar una cuota de un préstamo ajeno', async () => {
  const [cuotaB] = await prisma.cuota.findMany({
    where: { prestamoId: prestamoB.id, estado: { not: 'PAGADA' } },
    orderBy: { numero: 'asc' },
  });

  const { error } = await pagosService.registrarPago({ cuotaId: cuotaB.id, monto: 10 }, adminA.id);
  assert.equal(error, 'CUOTA_NO_ENCONTRADA');
});

test('listarPagos/obtenerPagoPorId: cada admin ve solo los pagos de su cartera', async () => {
  const deA = await pagosService.listarPagos({ administradorId: adminA.id });
  assert.ok(deA.some((p) => p.id === pagoA.id));
  assert.ok(!deA.some((p) => p.id === pagoB.id));

  assert.equal(await pagosService.obtenerPagoPorId(pagoB.id, { administradorId: adminA.id }), null);
  assert.ok(await pagosService.obtenerPagoPorId(pagoA.id, { administradorId: adminA.id }));
});

test('anularPago: no se puede anular el pago de otro admin', async () => {
  const { error } = await pagosService.anularPago(pagoB.id, adminA.id, 'intento cruzado');
  assert.equal(error, 'PAGO_NO_ENCONTRADO');

  const pagoBIntacto = await prisma.pago.findUnique({ where: { id: pagoB.id } });
  assert.equal(pagoBIntacto.estado, 'CONFIRMADO');
});

test('resumenAdministrador: los totales del dashboard no mezclan carteras', async () => {
  const resumenA = await dashboardService.resumenAdministrador(adminA.id);

  assert.equal(resumenA.clientesActivos, 1);
  assert.equal(resumenA.prestamosActivos, 1);
  // Capital de A (1000) sin el de B (500): si se mezclaran, sería 1500.
  assert.equal(resumenA.totalPrestado, '1000.00');
});

test('auditoria: cada admin ve solo su propia bitácora', async () => {
  const deA = await auditoriaService.listar({ usuarioId: adminA.id });
  assert.ok(deA.every((r) => r.usuarioId === adminA.id));
  assert.ok(deA.some((r) => r.entidad === 'PRESTAMO' && r.entidadId === prestamoA.id));
  assert.ok(!deA.some((r) => r.entidadId === prestamoB.id));
});
