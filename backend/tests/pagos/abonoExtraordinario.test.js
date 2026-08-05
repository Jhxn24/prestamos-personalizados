require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');
const Decimal = require('decimal.js');

const prisma = require('../../src/config/prisma');
const pagosService = require('../../src/modules/pagos/pagos.service');
const prestamosService = require('../../src/modules/prestamos/prestamos.service');

/**
 * RF-17 — abono extraordinario contra la base de datos real.
 *
 * Escenario base: 1000 en 4 cuotas mensuales al 5%. La cuota 1 vale 300
 * (50 de interés + 250 de capital). Pagando 800 quedan 500 de excedente y el
 * saldo baja a 250, que es exactamente una cuota de capital.
 */

const SUFIJO = `test-abono-${Date.now()}`;
let admin;
let usuarioCliente;
let cliente;

const dec = (valor) => new Decimal(valor.toString());

test.before(async () => {
  admin = await prisma.usuario.create({
    data: { email: `admin-${SUFIJO}@test.local`, password: 'x', rol: 'ADMINISTRADOR' },
  });
  cliente = await prisma.cliente.create({
    data: {
      nombre: 'Test',
      apellido: 'Abono',
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
  await prisma.prestamo.deleteMany({ where: { clienteId: cliente.id } });
  await prisma.cliente.delete({ where: { id: cliente.id } });
  await prisma.usuario.deleteMany({ where: { id: { in: [admin.id, usuarioCliente.id] } } });
  await prisma.$disconnect();
});

function crearPrestamo(modalidad = 'INTERES_SOBRE_SALDO') {
  return prestamosService.crearPrestamo({
    clienteId: cliente.id,
    capital: 1000,
    tasaInteres: 5,
    tipoInteres: 'MENSUAL',
    frecuenciaPago: 'MENSUAL',
    numeroCuotas: 4,
    modalidad,
    fechaDesembolso: new Date(),
  });
}

const cuotasDe = (prestamoId) =>
  prisma.cuota.findMany({ where: { prestamoId }, orderBy: { numero: 'asc' } });

async function verificarInvarianteDeSaldo(prestamoId) {
  const prestamo = await prisma.prestamo.findUnique({ where: { id: prestamoId } });
  const cuotas = await cuotasDe(prestamoId);

  const capitalPorCobrar = cuotas.reduce((acumulado, cuota) => {
    const porCobrar = dec(cuota.capital).minus(dec(cuota.capitalPagado));
    return porCobrar.gt(0) ? acumulado.plus(porCobrar) : acumulado;
  }, new Decimal(0));

  assert.equal(capitalPorCobrar.toFixed(2), dec(prestamo.capitalPendiente).toFixed(2));
}

test('REDUCIR_PLAZO: el cronograma pierde las cuotas que ya no hacen falta', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  const { pago } = await pagosService.registrarPago(
    { cuotaId: cuota1.id, monto: 800, politicaAbonoExtraordinario: 'REDUCIR_PLAZO' },
    admin.id
  );

  assert.equal(dec(pago.excedente).toFixed(2), '500.00');
  assert.equal(pago.cuotasEliminadas, 2, 'de 3 cuotas restantes deben sobrar 2');

  const cuotas = await cuotasDe(prestamo.id);
  assert.equal(cuotas.length, 2, 'quedan la cuota pagada y una final');
  assert.equal(dec(cuotas[1].capital).toFixed(2), '250.00', 'conserva el tamaño pactado');
  assert.equal(dec(cuotas[1].saldoCapital).toFixed(2), '0.00');

  const actualizado = await prisma.prestamo.findUnique({ where: { id: prestamo.id } });
  assert.equal(dec(actualizado.capitalPendiente).toFixed(2), '250.00');
  assert.equal(actualizado.numeroCuotas, 2, 'el plazo del préstamo debe reflejar el recorte');
  await verificarInvarianteDeSaldo(prestamo.id);
});

test('REDUCIR_CUOTA: mismo abono, se conservan las cuotas y baja su importe', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  const { pago } = await pagosService.registrarPago(
    { cuotaId: cuota1.id, monto: 800, politicaAbonoExtraordinario: 'REDUCIR_CUOTA' },
    admin.id
  );

  assert.equal(dec(pago.excedente).toFixed(2), '500.00');
  assert.equal(pago.cuotasEliminadas, 0);

  const cuotas = await cuotasDe(prestamo.id);
  assert.equal(cuotas.length, 4, 'el plazo no cambia');
  assert.deepEqual(
    cuotas.slice(1).map((c) => dec(c.capital).toFixed(2)),
    ['83.33', '83.33', '83.34']
  );
  await verificarInvarianteDeSaldo(prestamo.id);
});

test('las dos políticas amortizan el mismo capital pero cobran distinto interés', async () => {
  const conPlazo = await crearPrestamo();
  const conCuota = await crearPrestamo();

  await pagosService.registrarPago(
    {
      cuotaId: (await cuotasDe(conPlazo.id))[0].id,
      monto: 800,
      politicaAbonoExtraordinario: 'REDUCIR_PLAZO',
    },
    admin.id
  );
  await pagosService.registrarPago(
    {
      cuotaId: (await cuotasDe(conCuota.id))[0].id,
      monto: 800,
      politicaAbonoExtraordinario: 'REDUCIR_CUOTA',
    },
    admin.id
  );

  const [p1, p2] = await Promise.all([
    prisma.prestamo.findUnique({ where: { id: conPlazo.id } }),
    prisma.prestamo.findUnique({ where: { id: conCuota.id } }),
  ]);
  assert.equal(dec(p1.capitalPendiente).toFixed(2), dec(p2.capitalPendiente).toFixed(2));

  const sumaInteres = async (id) =>
    (await cuotasDe(id))
      .filter((cuota) => cuota.estado !== 'PAGADA')
      .reduce((acc, cuota) => acc.plus(dec(cuota.interes)), new Decimal(0));

  const interesPlazo = await sumaInteres(conPlazo.id);
  const interesCuota = await sumaInteres(conCuota.id);

  // Acortar el plazo mata la deuda antes, así que devenga menos interés
  assert.equal(interesPlazo.toFixed(2), '12.50');
  assert.equal(interesCuota.toFixed(2), '25.00');
  assert.ok(interesPlazo.lt(interesCuota));
});

test('un abono que liquida todo el capital deja el préstamo PAGADO', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  // 50 de interés + 1000 de capital
  await pagosService.registrarPago(
    { cuotaId: cuota1.id, monto: 1050, politicaAbonoExtraordinario: 'REDUCIR_PLAZO' },
    admin.id
  );

  const actualizado = await prisma.prestamo.findUnique({ where: { id: prestamo.id } });
  assert.equal(dec(actualizado.capitalPendiente).toFixed(2), '0.00');
  assert.equal(actualizado.estado, 'PAGADO');

  const cuotas = await cuotasDe(prestamo.id);
  assert.equal(cuotas.length, 1, 'las 3 cuotas sobrantes desaparecen');
});

test('sin excedente la política REDUCIR_PLAZO no altera el cronograma', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  // Paga exactamente la cuota: no hay abono extraordinario que aplicar
  const { pago } = await pagosService.registrarPago(
    { cuotaId: cuota1.id, monto: 300, politicaAbonoExtraordinario: 'REDUCIR_PLAZO' },
    admin.id
  );

  assert.equal(dec(pago.excedente).toFixed(2), '0.00');
  assert.equal(pago.cuotasEliminadas, 0);

  const cuotas = await cuotasDe(prestamo.id);
  assert.equal(cuotas.length, 4);
  assert.equal(dec(cuotas[1].capital).toFixed(2), '250.00');
});

test('interés fijo con REDUCIR_PLAZO: menos cuotas, cada una con su interés íntegro', async () => {
  const prestamo = await crearPrestamo('INTERES_FIJO');
  const [cuota1] = await cuotasDe(prestamo.id);

  await pagosService.registrarPago(
    { cuotaId: cuota1.id, monto: 800, politicaAbonoExtraordinario: 'REDUCIR_PLAZO' },
    admin.id
  );

  const cuotas = await cuotasDe(prestamo.id);
  assert.equal(cuotas.length, 2);
  // El interés fijo no baja: sigue siendo el 5% del capital original
  assert.equal(dec(cuotas[1].interes).toFixed(2), '50.00');
  assert.equal(dec(cuotas[1].capital).toFixed(2), '250.00');
  await verificarInvarianteDeSaldo(prestamo.id);
});

test('cuotas fijas con REDUCIR_PLAZO: se conserva el importe de la anualidad', async () => {
  const prestamo = await crearPrestamo('CUOTAS_FIJAS');
  const cuotasAntes = await cuotasDe(prestamo.id);
  assert.equal(dec(cuotasAntes[0].total).toFixed(2), '282.01');

  // Cuota 1 = 282.01. Paga 800 -> excedente de 517.99, saldo 1000-750.00 = 250.00
  await pagosService.registrarPago(
    { cuotaId: cuotasAntes[0].id, monto: 800, politicaAbonoExtraordinario: 'REDUCIR_PLAZO' },
    admin.id
  );

  const cuotas = await cuotasDe(prestamo.id);
  const pendientes = cuotas.filter((cuota) => cuota.estado !== 'PAGADA');

  // Con el saldo restante y la misma cuota pactada basta una sola
  assert.equal(pendientes.length, 1);
  assert.ok(dec(pendientes[0].total).lte(dec('282.01')), 'la última no puede exceder la cuota pactada');
  await verificarInvarianteDeSaldo(prestamo.id);
});

test('el administrador decide la política de abono extraordinario directamente al marcar el pago', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  const { pago } = await pagosService.registrarPago(
    { cuotaId: cuota1.id, monto: 800, politicaAbonoExtraordinario: 'REDUCIR_PLAZO' },
    admin.id
  );

  assert.equal(pago.cuotasEliminadas, 2);
  const cuotas = await cuotasDe(prestamo.id);
  assert.equal(cuotas.length, 2);
});

test('capital al final: REDUCIR_PLAZO no está soportado y falla con un error claro', async () => {
  const prestamo = await crearPrestamo('CAPITAL_AL_FINAL');
  const [cuota1] = await cuotasDe(prestamo.id);

  await assert.rejects(
    () =>
      pagosService.registrarPago(
        { cuotaId: cuota1.id, monto: 100, politicaAbonoExtraordinario: 'REDUCIR_PLAZO' },
        admin.id
      ),
    /Capital al final/
  );

  // la transacción revirtió por completo: ni el pago ni el préstamo cambiaron
  const actualizado = await prisma.prestamo.findUnique({ where: { id: prestamo.id } });
  assert.equal(dec(actualizado.capitalPendiente).toFixed(2), '1000.00');
});

test('un pago que elimina cuotas del cronograma no se puede anular automáticamente', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  const { pago } = await pagosService.registrarPago(
    { cuotaId: cuota1.id, monto: 800, politicaAbonoExtraordinario: 'REDUCIR_PLAZO' },
    admin.id
  );

  await assert.rejects(() => pagosService.anularPago(pago.id, admin.id), /redujo el plazo/);
});

test('eliminar cuotas no rompe los pagos que las referenciaban', async () => {
  const prestamo = await crearPrestamo();
  const cuotas = await cuotasDe(prestamo.id);

  // Un pago anulado apunta a la última cuota, que luego desaparecerá
  const { pago: anulable } = await pagosService.registrarPago(
    { cuotaId: cuotas[3].id, monto: 100 },
    admin.id
  );
  await pagosService.anularPago(anulable.id, admin.id, 'prueba');

  await pagosService.registrarPago(
    { cuotaId: cuotas[0].id, monto: 800, politicaAbonoExtraordinario: 'REDUCIR_PLAZO' },
    admin.id
  );

  const anulado = await prisma.pago.findUnique({ where: { id: anulable.id } });
  assert.equal(anulado.estado, 'ANULADO', 'el registro del pago debe sobrevivir');
  assert.equal(anulado.cuotaId, null, 'y quedar sin cuota asociada');
  assert.equal(dec(anulado.monto).toFixed(2), '100.00');
});
