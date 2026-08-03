const Decimal = require('decimal.js');
const prisma = require('../../config/prisma');
const { evaluarAtraso, estadoDeCuota } = require('../motor-calculo');

const dec = (valor) => new Decimal(valor.toString());

/**
 * Refresca el atraso y la mora de todas las cuotas abiertas de un préstamo (RF-16).
 *
 * Recalcula la mora COMPLETA de cada cuota a partir de sus días de atraso, en
 * vez de irla sumando. Así llamar a esta función dos veces el mismo día deja el
 * mismo resultado, y se puede refrescar libremente sin inflar la deuda.
 *
 * Recibe el cliente Prisma como parámetro para poder correr dentro de la misma
 * transacción que un pago, o por su cuenta desde el endpoint de refresco.
 */
async function actualizarMoraDePrestamo(client, prestamoId, fechaReferencia = new Date()) {
  const prestamo = await client.prestamo.findUnique({
    where: { id: prestamoId },
    include: { cuotas: { orderBy: { numero: 'asc' } } },
  });

  if (!prestamo) {
    return null;
  }

  let moraAcumulada = new Decimal(0);

  for (const cuota of prestamo.cuotas) {
    // Una cuota saldada ya no devenga mora, pero la que se le cobró sigue contando.
    if (cuota.estado === 'PAGADA') {
      moraAcumulada = moraAcumulada.plus(dec(cuota.mora));
      continue;
    }

    const capitalPendienteCuota = dec(cuota.capital).minus(dec(cuota.capitalPagado));

    const evaluacion = evaluarAtraso({
      politicaMora: prestamo.politicaMora,
      fechaVencimiento: cuota.fechaVencimiento,
      fechaReferencia,
      diasGracia: prestamo.diasGracia,
      tasaMoraDiaria: dec(prestamo.tasaMora),
      capitalPendienteCuota,
      extensionAplicada: cuota.extensionAplicada,
    });

    const montoPagado = dec(cuota.capitalPagado)
      .plus(dec(cuota.interesPagado))
      .plus(dec(cuota.moraPagada));

    await client.cuota.update({
      where: { id: cuota.id },
      data: {
        mora: evaluacion.mora.toFixed(2),
        diasAtraso: evaluacion.diasAtraso,
        estado: estadoDeCuota({
          montoPagado,
          total: dec(cuota.total),
          mora: evaluacion.mora,
          vencida: evaluacion.vencida,
        }),
        ...(evaluacion.nuevaFechaVencimiento
          ? { fechaVencimiento: evaluacion.nuevaFechaVencimiento, extensionAplicada: true }
          : {}),
        moraCalculadaEn: fechaReferencia,
      },
    });

    moraAcumulada = moraAcumulada.plus(evaluacion.mora);
  }

  await client.prestamo.update({
    where: { id: prestamoId },
    data: { moraAcumulada: moraAcumulada.toFixed(2) },
  });

  return client.prestamo.findUnique({
    where: { id: prestamoId },
    include: { cuotas: { orderBy: { numero: 'asc' } } },
  });
}

/** Refresco fuera de transacción, para el endpoint del administrador. */
function refrescarMora(prestamoId, fechaReferencia) {
  return prisma.$transaction((tx) => actualizarMoraDePrestamo(tx, prestamoId, fechaReferencia));
}

module.exports = { actualizarMoraDePrestamo, refrescarMora };
