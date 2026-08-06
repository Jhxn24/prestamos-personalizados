require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');

const prisma = require('../../src/config/prisma');
const pagosService = require('../../src/modules/pagos/pagos.service');
const prestamosService = require('../../src/modules/prestamos/prestamos.service');
const notificacionesService = require('../../src/modules/notificaciones/notificaciones.service');

/**
 * Pruebas de integración de notificaciones (RF-26, RF-27, RF-28) contra la
 * base de datos real: lo que importa verificar es a quién le llega cada aviso
 * y que el barrido diario no duplique notificaciones si se corre más de una
 * vez el mismo día.
 */

const SUFIJO = `test-notif-${Date.now()}`;
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
      apellido: 'Notif',
      documento: SUFIJO,
      administrador: { connect: { id: admin.id } },
      usuario: { create: { email: `cliente-${SUFIJO}@test.local`, password: 'x', rol: 'CLIENTE' } },
    },
    include: { usuario: true },
  });
  usuarioCliente = cliente.usuario;
});

test.after(async () => {
  // Los pagos disparan notificaciones (RF-27/RF-28) que llegan también a
  // TODOS los administradores reales de esta base de datos, no solo al `admin`
  // de esta prueba — hay que limpiarlas por prestamoId o quedan ensuciando la
  // bandeja del administrador real entre corridas.
  const prestamosDeLaPrueba = await prisma.prestamo.findMany({
    where: { clienteId: cliente.id },
    select: { id: true },
  });
  await prisma.notificacion.deleteMany({
    where: { prestamoId: { in: prestamosDeLaPrueba.map((p) => p.id) } },
  });

  await prisma.recibo.deleteMany({ where: { pago: { prestamo: { clienteId: cliente.id } } } });
  await prisma.pago.deleteMany({ where: { prestamo: { clienteId: cliente.id } } });
  await prisma.prestamo.updateMany({ where: { clienteId: cliente.id }, data: { prestamoOrigenId: null } });
  await prisma.prestamo.deleteMany({ where: { clienteId: cliente.id } });
  await prisma.cliente.delete({ where: { id: cliente.id } });
  // Cascade (onDelete: Cascade en Notificacion.usuarioId) se lleva las notificaciones de ambos.
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

const notificacionesDe = (usuarioId) =>
  prisma.notificacion.findMany({ where: { usuarioId }, orderBy: { createdAt: 'desc' } });

test('RF-25/RF-27: marcar un pago notifica al cliente que lo registró', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  const { pago } = await pagosService.registrarPago({ cuotaId: cuota1.id, monto: 300 }, admin.id);

  const notifs = await notificacionesDe(usuarioCliente.id);
  assert.ok(notifs.some((n) => n.tipo === 'PAGO_CONFIRMADO' && n.pagoId === pago.id));
});

test('anular un pago notifica al cliente con el motivo', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  const { pago } = await pagosService.registrarPago({ cuotaId: cuota1.id, monto: 300 }, admin.id);
  await pagosService.anularPago(pago.id, admin.id, 'comprobante ilegible');

  const notifs = await notificacionesDe(usuarioCliente.id);
  const anulacion = notifs.find((n) => n.tipo === 'PAGO_ANULADO' && n.pagoId === pago.id);
  assert.ok(anulacion);
  assert.match(anulacion.mensaje, /comprobante ilegible/);
});

test('un cliente sin cuenta de acceso no recibe notificaciones (no debe reventar)', async () => {
  const sinCuenta = await prisma.cliente.create({
    data: { nombre: 'Sin', apellido: 'Cuenta', documento: `${SUFIJO}-sin-cuenta`, administradorId: admin.id },
  });

  try {
    const prestamoSinCuenta = await prestamosService.crearPrestamo(
      {
        clienteId: sinCuenta.id,
        capital: 500,
        tasaInteres: 5,
        tipoInteres: 'MENSUAL',
        frecuenciaPago: 'MENSUAL',
        numeroCuotas: 2,
        modalidad: 'INTERES_FIJO',
        fechaDesembolso: new Date(),
      },
      admin.id
    );
    const [cuota1] = await cuotasDe(prestamoSinCuenta.id);

    // No debe lanzar, aunque no haya a quién notificar.
    const { pago } = await pagosService.registrarPago({ cuotaId: cuota1.id, monto: 100 }, admin.id);
    assert.equal(pago.estado, 'CONFIRMADO');

    await prisma.recibo.deleteMany({ where: { pago: { prestamoId: prestamoSinCuenta.id } } });
    await prisma.pago.deleteMany({ where: { prestamoId: prestamoSinCuenta.id } });
    await prisma.prestamo.delete({ where: { id: prestamoSinCuenta.id } });
  } finally {
    await prisma.cliente.delete({ where: { id: sinCuenta.id } });
  }
});

test('RF-26: recordatorios de vencimiento (hoy, mañana, en una semana) y es idempotente', async () => {
  const prestamo = await crearPrestamo();
  const cuotas = await cuotasDe(prestamo.id);

  const hoy = new Date();
  hoy.setUTCHours(0, 0, 0, 0);
  const manana = new Date(hoy);
  manana.setUTCDate(manana.getUTCDate() + 1);
  const enUnaSemana = new Date(hoy);
  enUnaSemana.setUTCDate(enUnaSemana.getUTCDate() + 7);

  await prisma.cuota.update({ where: { id: cuotas[0].id }, data: { fechaVencimiento: hoy } });
  await prisma.cuota.update({ where: { id: cuotas[1].id }, data: { fechaVencimiento: manana } });
  await prisma.cuota.update({ where: { id: cuotas[2].id }, data: { fechaVencimiento: enUnaSemana } });

  const creadas = await notificacionesService.generarRecordatoriosVencimiento(hoy);
  assert.equal(creadas, 3);

  const notifs = await notificacionesDe(usuarioCliente.id);
  assert.ok(notifs.some((n) => n.tipo === 'CUOTA_VENCE_HOY' && n.cuotaId === cuotas[0].id));
  assert.ok(notifs.some((n) => n.tipo === 'CUOTA_POR_VENCER_DIA' && n.cuotaId === cuotas[1].id));
  assert.ok(notifs.some((n) => n.tipo === 'CUOTA_POR_VENCER_SEMANA' && n.cuotaId === cuotas[2].id));

  // Correr el mismo barrido el mismo día no debe duplicar avisos.
  const segundaVuelta = await notificacionesService.generarRecordatoriosVencimiento(hoy);
  assert.equal(segundaVuelta, 0);
});

test('RF-26: un cliente sin cuenta de acceso no genera recordatorios (no debe reventar)', async () => {
  const sinCuenta = await prisma.cliente.create({
    data: {
      nombre: 'Sin',
      apellido: 'Recordatorio',
      documento: `${SUFIJO}-sin-recordatorio`,
      administradorId: admin.id,
    },
  });

  try {
    const prestamoSinCuenta = await prestamosService.crearPrestamo(
      {
        clienteId: sinCuenta.id,
        capital: 500,
        tasaInteres: 5,
        tipoInteres: 'MENSUAL',
        frecuenciaPago: 'MENSUAL',
        numeroCuotas: 2,
        modalidad: 'INTERES_FIJO',
        fechaDesembolso: new Date(),
      },
      admin.id
    );
    const [cuota1] = await cuotasDe(prestamoSinCuenta.id);

    const hoy = new Date();
    hoy.setUTCHours(0, 0, 0, 0);
    await prisma.cuota.update({ where: { id: cuota1.id }, data: { fechaVencimiento: hoy } });

    // No debe lanzar, aunque no haya a quién notificar.
    await notificacionesService.generarRecordatoriosVencimiento(hoy);

    await prisma.prestamo.delete({ where: { id: prestamoSinCuenta.id } });
  } finally {
    await prisma.cliente.delete({ where: { id: sinCuenta.id } });
  }
});

test('RF-28: resumen diario del administrador y es idempotente', async () => {
  // generarResumenAdmin notifica a TODOS los administradores activos de la
  // base de datos, no solo al `admin` de esta prueba — incluye al
  // administrador real sembrado en el entorno de desarrollo. Se acota la
  // limpieza por ventana de tiempo para no tocar resúmenes de otros días.
  const inicioDeLaPrueba = new Date();
  const hoy = new Date();

  try {
    const creadas = await notificacionesService.generarResumenAdmin(hoy);
    assert.ok(creadas >= 1);

    const notifs = await notificacionesDe(admin.id);
    assert.ok(notifs.some((n) => n.tipo === 'RESUMEN_DIARIO_ADMIN'));

    const segundaVuelta = await notificacionesService.generarResumenAdmin(hoy);
    assert.equal(segundaVuelta, 0);
  } finally {
    await prisma.notificacion.deleteMany({
      where: { tipo: 'RESUMEN_DIARIO_ADMIN', createdAt: { gte: inicioDeLaPrueba } },
    });
  }
});
