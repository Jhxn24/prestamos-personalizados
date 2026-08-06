require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');

const prisma = require('../../src/config/prisma');
const pagosService = require('../../src/modules/pagos/pagos.service');
const prestamosService = require('../../src/modules/prestamos/prestamos.service');
const clientesService = require('../../src/modules/clientes/clientes.service');
const auditoriaService = require('../../src/modules/auditoria/auditoria.service');

/**
 * Pruebas de integración de la bitácora de auditoría (RF-36, RNF-12): que las
 * acciones relevantes (alta/edición de cliente, alta/recálculo/refinanciamiento
 * de préstamo, confirmación/rechazo de pago) queden registradas con el usuario
 * que las hizo.
 */

const SUFIJO = `test-audit-${Date.now()}`;
let admin;
let usuarioCliente;
let cliente;

test.before(async () => {
  admin = await prisma.usuario.create({
    data: { email: `admin-${SUFIJO}@test.local`, password: 'x', rol: 'ADMINISTRADOR' },
  });

  cliente = await prisma.cliente.create({
    data: {
      nombre: 'Test',
      apellido: 'Audit',
      documento: SUFIJO,
      administrador: { connect: { id: admin.id } },
      usuario: { create: { email: `cliente-${SUFIJO}@test.local`, password: 'x', rol: 'CLIENTE' } },
    },
    include: { usuario: true },
  });
  usuarioCliente = cliente.usuario;
});

test.after(async () => {
  const prestamosDeLaPrueba = await prisma.prestamo.findMany({
    where: { clienteId: cliente.id },
    select: { id: true },
  });

  await prisma.recibo.deleteMany({ where: { pago: { prestamo: { clienteId: cliente.id } } } });
  await prisma.pago.deleteMany({ where: { prestamo: { clienteId: cliente.id } } });
  await prisma.prestamo.updateMany({ where: { clienteId: cliente.id }, data: { prestamoOrigenId: null } });
  await prisma.prestamo.deleteMany({ where: { clienteId: cliente.id } });
  await prisma.cliente.delete({ where: { id: cliente.id } });
  await prisma.usuario.deleteMany({ where: { id: { in: [admin.id, usuarioCliente.id] } } });
  await prisma.$disconnect();
});

function crearPrestamo() {
  return prestamosService.crearPrestamo(
    {
      clienteId: cliente.id,
      capital: 1000,
      tasaInteres: 5,
      tipoInteres: 'MENSUAL',
      frecuenciaPago: 'MENSUAL',
      numeroCuotas: 4,
      modalidad: 'INTERES_SOBRE_SALDO',
      fechaDesembolso: new Date(),
    },
    admin.id
  );
}

const cuotasDe = (prestamoId) =>
  prisma.cuota.findMany({ where: { prestamoId }, orderBy: { numero: 'asc' } });

test('RF-36: registrar un préstamo deja constancia en la bitácora con el usuario que lo creó', async () => {
  const prestamo = await crearPrestamo();

  const registros = await auditoriaService.listar({ entidad: 'PRESTAMO', entidadId: prestamo.id });
  assert.equal(registros.length, 1);
  assert.equal(registros[0].accion, 'CREAR');
  assert.equal(registros[0].usuarioId, admin.id);
  assert.match(registros[0].detalle, /1000/);
});

test('RF-36: recalcular un préstamo queda registrado', async () => {
  const prestamo = await crearPrestamo();

  await prestamosService.recalcularPrestamo(prestamo.id, { numeroCuotas: 6 }, admin.id);

  const registros = await auditoriaService.listar({ entidad: 'PRESTAMO', entidadId: prestamo.id });
  assert.ok(registros.some((r) => r.accion === 'RECALCULAR' && r.usuarioId === admin.id));
});

test('RF-36: refinanciar un préstamo registra la bitácora sobre el préstamo nuevo', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);
  await pagosService.registrarPago({ cuotaId: cuota1.id, monto: 300 }, admin.id);

  const refinanciado = await prestamosService.refinanciarPrestamo(prestamo.id, {}, admin.id);

  const registros = await auditoriaService.listar({ entidad: 'PRESTAMO', entidadId: refinanciado.id });
  assert.ok(registros.some((r) => r.accion === 'REFINANCIAR'));
  assert.match(registros[0].detalle, new RegExp(prestamo.id));
});

test('RF-36: un pago directo del administrador (RF-25) se registra como CONFIRMAR', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  const { pago } = await pagosService.registrarPago({ cuotaId: cuota1.id, monto: 300 }, admin.id);

  const registros = await auditoriaService.listar({ entidad: 'PAGO', entidadId: pago.id });
  assert.equal(registros.length, 1);
  assert.equal(registros[0].accion, 'CONFIRMAR');
  assert.equal(registros[0].usuarioId, admin.id);
});

test('RF-36: anular un pago queda registrado con el administrador que lo anuló', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  const { pago } = await pagosService.registrarPago({ cuotaId: cuota1.id, monto: 300 }, admin.id);
  await pagosService.anularPago(pago.id, admin.id, 'marcado por error');

  const registros = await auditoriaService.listar({ entidad: 'PAGO', entidadId: pago.id });
  const anulacion = registros.find((r) => r.accion === 'ANULAR');
  assert.ok(anulacion);
  assert.equal(anulacion.usuarioId, admin.id);
  assert.match(anulacion.detalle, /marcado por error/);
});

test('RF-01/02/36: alta y edición de cliente quedan registradas', async () => {
  const sufijoCliente = `${SUFIJO}-cli2`;
  const nuevo = await clientesService.crearCliente(
    {
      nombre: 'Otro',
      apellido: 'Cliente',
      documento: sufijoCliente,
      email: `otro-${sufijoCliente}@test.local`,
      password: 'x',
    },
    admin.id
  );

  try {
    const registrosAlta = await auditoriaService.listar({ entidad: 'CLIENTE', entidadId: nuevo.id });
    assert.equal(registrosAlta.length, 1);
    assert.equal(registrosAlta[0].accion, 'CREAR');

    await clientesService.actualizarCliente(nuevo.id, { telefono: '999888777' }, admin.id);

    const registrosEdicion = await auditoriaService.listar({ entidad: 'CLIENTE', entidadId: nuevo.id });
    const edicion = registrosEdicion.find((r) => r.accion === 'ACTUALIZAR');
    assert.ok(edicion);
    assert.match(edicion.detalle, /telefono/);
  } finally {
    await prisma.cliente.delete({ where: { id: nuevo.id } });
    await prisma.usuario.delete({ where: { id: nuevo.usuarioId } });
  }
});
