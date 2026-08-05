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
  return prestamosService.crearPrestamo({
    clienteId: cliente.id,
    capital: 1000,
    tasaInteres: 5,
    tipoInteres: 'MENSUAL',
    frecuenciaPago: 'MENSUAL',
    numeroCuotas: 4,
    modalidad: 'INTERES_SOBRE_SALDO',
    fechaDesembolso: new Date(),
  });
}

const cuotasDe = (prestamoId) =>
  prisma.cuota.findMany({ where: { prestamoId }, orderBy: { numero: 'asc' } });

const notificacionesDe = (usuarioId) =>
  prisma.notificacion.findMany({ where: { usuarioId }, orderBy: { createdAt: 'desc' } });

test('RF-27/RF-28: reportar un pago notifica al cliente (recibido) y a los administradores (pendiente)', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  await pagosService.registrarPago({ cuotaId: cuota1.id, monto: 300 }, usuarioCliente);

  const notifsCliente = await notificacionesDe(usuarioCliente.id);
  assert.ok(
    notifsCliente.some((n) => n.tipo === 'PAGO_REPORTADO' && n.cuotaId === cuota1.id),
    'el cliente debe recibir la confirmación de que su pago fue recibido'
  );

  const notifsAdmin = await notificacionesDe(admin.id);
  assert.ok(
    notifsAdmin.some((n) => n.tipo === 'PAGO_REPORTADO' && n.cuotaId === cuota1.id),
    'el administrador debe ser avisado del pago pendiente de confirmar'
  );
});

test('RF-27: confirmar un pago notifica al cliente', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  const { pago } = await pagosService.registrarPago({ cuotaId: cuota1.id, monto: 300 }, usuarioCliente);
  await pagosService.confirmarPago(pago.id, admin.id);

  const notifs = await notificacionesDe(usuarioCliente.id);
  assert.ok(notifs.some((n) => n.tipo === 'PAGO_CONFIRMADO' && n.pagoId === pago.id));
});

test('RF-27: rechazar un pago notifica al cliente con el motivo', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  const { pago } = await pagosService.registrarPago({ cuotaId: cuota1.id, monto: 300 }, usuarioCliente);
  await pagosService.rechazarPago(pago.id, admin.id, 'comprobante ilegible');

  const notifs = await notificacionesDe(usuarioCliente.id);
  const rechazo = notifs.find((n) => n.tipo === 'PAGO_RECHAZADO' && n.pagoId === pago.id);
  assert.ok(rechazo);
  assert.match(rechazo.mensaje, /comprobante ilegible/);
});

test('RF-25: un pago registrado directo por el administrador también notifica al cliente', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  const { pago } = await pagosService.registrarPago({ cuotaId: cuota1.id, monto: 300 }, admin);

  const notifs = await notificacionesDe(usuarioCliente.id);
  assert.ok(notifs.some((n) => n.tipo === 'PAGO_CONFIRMADO' && n.pagoId === pago.id));
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
