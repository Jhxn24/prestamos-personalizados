const Decimal = require('decimal.js');
const prisma = require('../../config/prisma');

const dec = (valor) => new Decimal(valor.toString());
const money = (valor) => dec(valor).toFixed(2);

const CUOTAS_ABIERTAS = { estado: { not: 'PAGADA' } };

function inicioDelDia(fecha = new Date()) {
  const dia = new Date(fecha);
  dia.setHours(0, 0, 0, 0);
  return dia;
}

function sumar(items, campo) {
  return items.reduce((total, item) => total.plus(dec(item[campo])), new Decimal(0));
}

/**
 * Dashboard del administrador (RF-29): visión general del negocio.
 */
async function resumenAdministrador(administradorId) {
  const hoy = inicioDelDia();
  const en7Dias = new Date(hoy);
  en7Dias.setDate(en7Dias.getDate() + 7);
  const inicioSemana = new Date(hoy);
  inicioSemana.setDate(inicioSemana.getDate() - hoy.getDay());
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  const [prestamos, clientesActivos, pagosConfirmados, cuotasProximas] = await Promise.all([
    prisma.prestamo.findMany({
      where: { estado: { not: 'CANCELADO' }, cliente: { administradorId } },
      select: {
        id: true,
        estado: true,
        capital: true,
        capitalPendiente: true,
        clienteId: true,
        cuotas: { where: CUOTAS_ABIERTAS, select: { estado: true } },
      },
    }),
    prisma.cliente.count({ where: { activo: true, administradorId } }),
    prisma.pago.findMany({
      where: { estado: 'CONFIRMADO', prestamo: { cliente: { administradorId } } },
      select: { monto: true, interesAplicado: true, fechaConfirmacion: true },
    }),
    prisma.cuota.findMany({
      where: {
        estado: { in: ['PENDIENTE', 'PARCIAL'] },
        fechaVencimiento: { gte: hoy, lte: en7Dias },
        prestamo: { estado: 'ACTIVO', cliente: { administradorId } },
      },
      select: {
        id: true,
        numero: true,
        fechaVencimiento: true,
        total: true,
        montoPagado: true,
        prestamoId: true,
        prestamo: {
          select: { cliente: { select: { id: true, nombre: true, apellido: true } } },
        },
      },
      orderBy: { fechaVencimiento: 'asc' },
    }),
  ]);

  const activos = prestamos.filter((p) => p.estado === 'ACTIVO');
  const prestamosVencidos = activos.filter((p) => p.cuotas.some((c) => c.estado === 'VENCIDA'));
  const clientesMorosos = new Set(prestamosVencidos.map((p) => p.clienteId));

  const pagosDelRango = (desde) =>
    pagosConfirmados.filter((pago) => pago.fechaConfirmacion && pago.fechaConfirmacion >= desde);

  return {
    totalPrestado: money(sumar(prestamos, 'capital')),
    totalRecuperado: money(sumar(pagosConfirmados, 'monto')),
    interesesGanados: money(sumar(pagosConfirmados, 'interesAplicado')),
    capitalPendiente: money(sumar(activos, 'capitalPendiente')),
    clientesActivos,
    clientesMorosos: clientesMorosos.size,
    prestamosVencidos: prestamosVencidos.length,
    prestamosActivos: activos.length,
    proximosCobros: cuotasProximas.map((cuota) => ({
      prestamoId: cuota.prestamoId,
      cuotaId: cuota.id,
      numeroCuota: cuota.numero,
      cliente: `${cuota.prestamo.cliente.nombre} ${cuota.prestamo.cliente.apellido}`,
      fechaVencimiento: cuota.fechaVencimiento,
      montoPendiente: money(dec(cuota.total).minus(dec(cuota.montoPagado))),
    })),
    flujoCaja: {
      hoy: money(sumar(pagosDelRango(hoy), 'monto')),
      semana: money(sumar(pagosDelRango(inicioSemana), 'monto')),
      mes: money(sumar(pagosDelRango(inicioMes), 'monto')),
    },
  };
}

/**
 * Dashboard del cliente (RF-30): estado de cada préstamo propio.
 */
async function resumenCliente(clienteId) {
  const prestamos = await prisma.prestamo.findMany({
    where: { clienteId },
    include: {
      cuotas: { orderBy: { numero: 'asc' } },
      pagos: {
        where: { estado: 'CONFIRMADO' },
        orderBy: { fechaConfirmacion: 'desc' },
        select: { id: true, monto: true, metodo: true, fechaConfirmacion: true, cuotaId: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return prestamos.map((prestamo) => {
    const cuotasAbiertas = prestamo.cuotas.filter((c) => c.estado !== 'PAGADA');
    const interesPendiente = cuotasAbiertas.reduce(
      (total, c) => total.plus(dec(c.interes).minus(dec(c.interesPagado))),
      new Decimal(0)
    );
    const proximaCuota = cuotasAbiertas[0] ?? null;

    return {
      id: prestamo.id,
      estado: prestamo.estado,
      modalidad: prestamo.modalidad,
      capital: money(prestamo.capital),
      capitalPendiente: money(prestamo.capitalPendiente),
      interesPendiente: money(interesPendiente),
      moraAcumulada: money(prestamo.moraAcumulada),
      proximaFechaPago: proximaCuota?.fechaVencimiento ?? null,
      proximoMonto: proximaCuota
        ? money(dec(proximaCuota.total).minus(dec(proximaCuota.montoPagado)))
        : null,
      cronograma: prestamo.cuotas.map((c) => ({
        numero: c.numero,
        fechaVencimiento: c.fechaVencimiento,
        total: money(c.total),
        montoPagado: money(c.montoPagado),
        mora: money(c.mora),
        estado: c.estado,
      })),
      historialPagos: prestamo.pagos.map((pago) => ({
        id: pago.id,
        monto: money(pago.monto),
        metodo: pago.metodo,
        fecha: pago.fechaConfirmacion,
        cuotaId: pago.cuotaId,
      })),
    };
  });
}

module.exports = { resumenAdministrador, resumenCliente };
