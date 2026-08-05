const Decimal = require('decimal.js');
const prisma = require('../../config/prisma');
const { agregarDias } = require('../motor-calculo/fechas');

const dec = (valor) => new Decimal(valor.toString());

function inicioDelDiaUTC(fecha = new Date()) {
  const dia = new Date(fecha.getTime());
  dia.setUTCHours(0, 0, 0, 0);
  return dia;
}

function formatearFechaCorta(fecha) {
  return new Date(fecha).toLocaleDateString('es-PE', { timeZone: 'UTC' });
}

/** Crea una notificación para un usuario puntual. */
function crear({ usuarioId, tipo, titulo, mensaje, prestamoId, cuotaId, pagoId }) {
  return prisma.notificacion.create({
    data: {
      usuarioId,
      tipo,
      titulo,
      mensaje,
      prestamoId: prestamoId ?? null,
      cuotaId: cuotaId ?? null,
      pagoId: pagoId ?? null,
    },
  });
}

/** Crea la misma notificación para todos los administradores activos (RF-28). */
async function crearParaAdministradores({ tipo, titulo, mensaje, prestamoId, cuotaId, pagoId }) {
  const administradores = await prisma.usuario.findMany({
    where: { rol: 'ADMINISTRADOR', activo: true },
    select: { id: true },
  });

  if (administradores.length === 0) return [];

  await prisma.notificacion.createMany({
    data: administradores.map((admin) => ({
      usuarioId: admin.id,
      tipo,
      titulo,
      mensaje,
      prestamoId: prestamoId ?? null,
      cuotaId: cuotaId ?? null,
      pagoId: pagoId ?? null,
    })),
  });

  return administradores;
}

function listar(usuarioId, { soloNoLeidas } = {}) {
  return prisma.notificacion.findMany({
    where: { usuarioId, leida: soloNoLeidas ? false : undefined },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

function contarNoLeidas(usuarioId) {
  return prisma.notificacion.count({ where: { usuarioId, leida: false } });
}

async function marcarLeida(id, usuarioId) {
  const { count } = await prisma.notificacion.updateMany({
    where: { id, usuarioId },
    data: { leida: true },
  });
  return count > 0;
}

function marcarTodasLeidas(usuarioId) {
  return prisma.notificacion.updateMany({
    where: { usuarioId, leida: false },
    data: { leida: true },
  });
}

/**
 * RF-26: avisa al cliente cuando falte una semana, un día o el mismo día para
 * el vencimiento de una cuota.
 *
 * Cada ventana se evalúa por el día calendario (UTC) de `fechaVencimiento`,
 * ignorando la hora. Antes de crear una notificación se comprueba que no
 * exista ya una del mismo tipo para esa cuota emitida hoy, así que la función
 * es segura de llamar más de una vez el mismo día (idempotente).
 */
async function generarRecordatoriosVencimiento(fechaReferencia = new Date()) {
  const hoy = inicioDelDiaUTC(fechaReferencia);

  const ventanas = [
    { desde: hoy, etiqueta: 'hoy', tipo: 'CUOTA_VENCE_HOY', titulo: 'Tu cuota vence hoy' },
    { desde: agregarDias(hoy, 1), etiqueta: 'mañana', tipo: 'CUOTA_POR_VENCER_DIA', titulo: 'Tu cuota vence mañana' },
    { desde: agregarDias(hoy, 7), etiqueta: 'en una semana', tipo: 'CUOTA_POR_VENCER_SEMANA', titulo: 'Tu cuota vence en una semana' },
  ];

  let creadas = 0;

  for (const ventana of ventanas) {
    const hasta = agregarDias(ventana.desde, 1);

    const cuotas = await prisma.cuota.findMany({
      where: {
        estado: { in: ['PENDIENTE', 'PARCIAL'] },
        fechaVencimiento: { gte: ventana.desde, lt: hasta },
        prestamo: { estado: 'ACTIVO' },
      },
      select: {
        id: true,
        numero: true,
        fechaVencimiento: true,
        total: true,
        montoPagado: true,
        prestamoId: true,
        prestamo: { select: { cliente: { select: { usuarioId: true } } } },
      },
    });

    for (const cuota of cuotas) {
      // Un cliente sin cuenta de acceso (RF-04 opcional) no tiene a quién notificar.
      if (!cuota.prestamo.cliente.usuarioId) continue;

      const yaNotificada = await prisma.notificacion.findFirst({
        where: { cuotaId: cuota.id, tipo: ventana.tipo, createdAt: { gte: hoy } },
        select: { id: true },
      });
      if (yaNotificada) continue;

      const montoPendiente = dec(cuota.total).minus(dec(cuota.montoPagado)).toFixed(2);

      await crear({
        usuarioId: cuota.prestamo.cliente.usuarioId,
        tipo: ventana.tipo,
        titulo: ventana.titulo,
        mensaje: `La cuota #${cuota.numero} vence ${ventana.etiqueta} (${formatearFechaCorta(cuota.fechaVencimiento)}) por S/ ${montoPendiente}.`,
        prestamoId: cuota.prestamoId,
        cuotaId: cuota.id,
      });
      creadas++;
    }
  }

  return creadas;
}

/**
 * RF-28: resumen diario para cada administrador con cobros del día, cobros de
 * la semana y clientes morosos.
 *
 * A lo sumo un resumen por administrador por día (idempotente igual que los
 * recordatorios de vencimiento).
 */
async function generarResumenAdmin(fechaReferencia = new Date()) {
  const hoy = inicioDelDiaUTC(fechaReferencia);
  const finHoy = agregarDias(hoy, 1);
  const finSemana = agregarDias(hoy, 7);

  const [cuotasHoy, cuotasSemana, prestamosActivos, administradores] = await Promise.all([
    prisma.cuota.findMany({
      where: {
        estado: { in: ['PENDIENTE', 'PARCIAL'] },
        fechaVencimiento: { gte: hoy, lt: finHoy },
        prestamo: { estado: 'ACTIVO' },
      },
      select: { total: true, montoPagado: true },
    }),
    prisma.cuota.findMany({
      where: {
        estado: { in: ['PENDIENTE', 'PARCIAL'] },
        fechaVencimiento: { gte: hoy, lt: finSemana },
        prestamo: { estado: 'ACTIVO' },
      },
      select: { total: true, montoPagado: true },
    }),
    prisma.prestamo.findMany({
      where: { estado: 'ACTIVO' },
      select: { clienteId: true, cuotas: { where: { estado: 'VENCIDA' }, select: { id: true } } },
    }),
    prisma.usuario.findMany({ where: { rol: 'ADMINISTRADOR', activo: true }, select: { id: true } }),
  ]);

  const sumarPendiente = (cuotas) =>
    cuotas.reduce((total, cuota) => total.plus(dec(cuota.total).minus(dec(cuota.montoPagado))), new Decimal(0));

  const cobrosHoy = sumarPendiente(cuotasHoy).toFixed(2);
  const cobrosSemana = sumarPendiente(cuotasSemana).toFixed(2);
  const clientesMorosos = new Set(
    prestamosActivos.filter((p) => p.cuotas.length > 0).map((p) => p.clienteId)
  ).size;

  const mensaje =
    `Cobros de hoy: S/ ${cobrosHoy}. Cobros de la semana: S/ ${cobrosSemana}. ` +
    `Clientes morosos: ${clientesMorosos}.`;

  let creadas = 0;
  for (const admin of administradores) {
    const yaNotificado = await prisma.notificacion.findFirst({
      where: { usuarioId: admin.id, tipo: 'RESUMEN_DIARIO_ADMIN', createdAt: { gte: hoy } },
      select: { id: true },
    });
    if (yaNotificado) continue;

    await crear({
      usuarioId: admin.id,
      tipo: 'RESUMEN_DIARIO_ADMIN',
      titulo: 'Resumen del día',
      mensaje,
    });
    creadas++;
  }

  return creadas;
}

module.exports = {
  crear,
  crearParaAdministradores,
  listar,
  contarNoLeidas,
  marcarLeida,
  marcarTodasLeidas,
  generarRecordatoriosVencimiento,
  generarResumenAdmin,
};
