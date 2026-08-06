require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');
const Decimal = require('decimal.js');

const prisma = require('../../src/config/prisma');
const pagosService = require('../../src/modules/pagos/pagos.service');
const prestamosService = require('../../src/modules/prestamos/prestamos.service');

/**
 * Pruebas de integración del módulo de pagos contra la base de datos real.
 *
 * La lógica de pagos es transaccional y toca cuatro tablas a la vez, así que
 * probarla solo con dobles no diría nada útil: lo que hay que verificar es que
 * el saldo del préstamo y su cronograma queden consistentes DESPUÉS de escribir.
 */

const SUFIJO = `test-pagos-${Date.now()}`;
let admin;
let cliente;

const dec = (valor) => new Decimal(valor.toString());

test.before(async () => {
  admin = await prisma.usuario.create({
    data: { email: `admin-${SUFIJO}@test.local`, password: 'x', rol: 'ADMINISTRADOR' },
  });

  cliente = await prisma.cliente.create({
    data: {
      nombre: 'Test',
      apellido: 'Pagos',
      documento: SUFIJO,
      administrador: { connect: { id: admin.id } },
      usuario: { create: { email: `cliente-${SUFIJO}@test.local`, password: 'x', rol: 'CLIENTE' } },
    },
    include: { usuario: true },
  });
});

test.after(async () => {
  // Los pagos disparan notificaciones (RF-27) que llegan también a TODOS los
  // administradores reales de esta base de datos, no solo al `admin` de esta
  // prueba — hay que limpiarlas por prestamoId o quedan ensuciando la bandeja
  // del administrador real entre corridas.
  const prestamosDeLaPrueba = await prisma.prestamo.findMany({
    where: { clienteId: cliente.id },
    select: { id: true },
  });
  await prisma.notificacion.deleteMany({
    where: { prestamoId: { in: prestamosDeLaPrueba.map((p) => p.id) } },
  });

  await prisma.recibo.deleteMany({ where: { pago: { prestamo: { clienteId: cliente.id } } } });
  await prisma.pagoSnapshot.deleteMany({ where: { pago: { prestamo: { clienteId: cliente.id } } } });
  await prisma.pago.deleteMany({ where: { prestamo: { clienteId: cliente.id } } });
  await prisma.prestamo.updateMany({ where: { clienteId: cliente.id }, data: { prestamoOrigenId: null } });
  await prisma.prestamo.deleteMany({ where: { clienteId: cliente.id } });
  await prisma.cliente.delete({ where: { id: cliente.id } });
  await prisma.usuario.deleteMany({ where: { id: { in: [admin.id, cliente.usuario.id] } } });
  await prisma.$disconnect();
});

/**
 * Préstamo de 1000 en 4 cuotas al 5% por cuota, desembolsado HOY.
 *
 * La fecha es relativa a propósito: con una fecha fija, el paso del tiempo
 * acabaría venciendo las cuotas y estas pruebas —que son sobre la mecánica de
 * pagos, no sobre la mora— empezarían a fallar solas. El atraso se prueba
 * aparte, en mora.test.js, con fechas de referencia explícitas.
 */
async function crearPrestamo(modalidad = 'INTERES_SOBRE_SALDO') {
  return prestamosService.crearPrestamo(
    {
      clienteId: cliente.id,
      capital: 1000,
      tasaInteres: 5,
      tipoInteres: 'MENSUAL',
      frecuenciaPago: 'MENSUAL',
      numeroCuotas: 4,
      modalidad,
      fechaDesembolso: new Date(),
    },
    admin.id
  );
}

const cuotasDe = (prestamoId) =>
  prisma.cuota.findMany({ where: { prestamoId }, orderBy: { numero: 'asc' } });

/**
 * Invariante central del módulo: el capital pendiente del préstamo debe ser
 * igual al capital que todavía reclaman sus cuotas. Si se separan, el negocio
 * está cobrando de más o de menos.
 */
async function verificarInvarianteDeSaldo(prestamoId) {
  const prestamo = await prisma.prestamo.findUnique({ where: { id: prestamoId } });
  const cuotas = await cuotasDe(prestamoId);

  const capitalPorCobrar = cuotas.reduce((acumulado, cuota) => {
    const porCobrar = dec(cuota.capital).minus(dec(cuota.capitalPagado));
    return porCobrar.gt(0) ? acumulado.plus(porCobrar) : acumulado;
  }, new Decimal(0));

  assert.equal(
    capitalPorCobrar.toFixed(2),
    dec(prestamo.capitalPendiente).toFixed(2),
    'el capital pendiente del préstamo no coincide con el de sus cuotas'
  );
}

test('RF-25: al marcar un pago se aplica de inmediato y se emite el recibo', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  const { pago } = await pagosService.registrarPago({ cuotaId: cuota1.id, monto: 300 }, admin.id);

  assert.equal(pago.estado, 'CONFIRMADO');
  assert.equal(dec(pago.interesAplicado).toFixed(2), '50.00');
  assert.equal(dec(pago.capitalAplicado).toFixed(2), '250.00');
  assert.ok(pago.recibo, 'debe existir un recibo');
  assert.equal(dec(pago.recibo.monto).toFixed(2), '300.00');

  const despues = await prisma.prestamo.findUnique({ where: { id: prestamo.id } });
  assert.equal(dec(despues.capitalPendiente).toFixed(2), '750.00');
  assert.equal(dec(despues.interesAcumulado).toFixed(2), '50.00');

  const cuotas = await cuotasDe(prestamo.id);
  assert.equal(cuotas[0].estado, 'PAGADA');
  await verificarInvarianteDeSaldo(prestamo.id);
});

test('RF-15: un pago parcial deja la cuota PARCIAL y baja el saldo solo lo abonado', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  await pagosService.registrarPago({ cuotaId: cuota1.id, monto: 150 }, admin.id);

  const cuotas = await cuotasDe(prestamo.id);
  assert.equal(cuotas[0].estado, 'PARCIAL');
  assert.equal(dec(cuotas[0].interesPagado).toFixed(2), '50.00');
  assert.equal(dec(cuotas[0].capitalPagado).toFixed(2), '100.00');

  const despues = await prisma.prestamo.findUnique({ where: { id: prestamo.id } });
  assert.equal(dec(despues.capitalPendiente).toFixed(2), '900.00');
  await verificarInvarianteDeSaldo(prestamo.id);
});

test('RF-12: un pago que solo cubre interés deja el capital intacto', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  await pagosService.registrarPago({ cuotaId: cuota1.id, monto: 50 }, admin.id);

  const despues = await prisma.prestamo.findUnique({ where: { id: prestamo.id } });
  assert.equal(dec(despues.capitalPendiente).toFixed(2), '1000.00');
  assert.equal(dec(despues.interesAcumulado).toFixed(2), '50.00');

  const cuotas = await cuotasDe(prestamo.id);
  assert.equal(cuotas[0].estado, 'PARCIAL');
  assert.equal(dec(cuotas[0].capitalPagado).toFixed(2), '0.00');
  await verificarInvarianteDeSaldo(prestamo.id);
});

test('RF-11/RF-13: sobre saldo, un abono extra reduce el interés de las cuotas futuras', async () => {
  const prestamo = await crearPrestamo('INTERES_SOBRE_SALDO');
  const cuotasAntes = await cuotasDe(prestamo.id);

  // Cuota 1 = 300 (50 interés + 250 capital). Paga 500: 200 de excedente a capital.
  await pagosService.registrarPago({ cuotaId: cuotasAntes[0].id, monto: 500 }, admin.id);

  const despues = await prisma.prestamo.findUnique({ where: { id: prestamo.id } });
  assert.equal(dec(despues.capitalPendiente).toFixed(2), '550.00');

  const cuotas = await cuotasDe(prestamo.id);
  // Las 3 futuras reparten 550 y cobran interés sobre el saldo real
  assert.deepEqual(
    cuotas.slice(1).map((c) => dec(c.capital).toFixed(2)),
    ['183.33', '183.33', '183.34']
  );
  assert.equal(dec(cuotas[1].interes).toFixed(2), '27.50'); // 5% de 550, no de 750
  assert.ok(dec(cuotas[1].interes).lt(dec(cuotasAntes[1].interes)), 'el interés futuro debe bajar');
  await verificarInvarianteDeSaldo(prestamo.id);
});

test('interés fijo: el abono extra reduce el capital pero NO el interés futuro', async () => {
  const prestamo = await crearPrestamo('INTERES_FIJO');
  const cuotasAntes = await cuotasDe(prestamo.id);

  await pagosService.registrarPago({ cuotaId: cuotasAntes[0].id, monto: 500 }, admin.id);

  const cuotas = await cuotasDe(prestamo.id);
  // El interés sigue siendo 5% del capital ORIGINAL (1000) en todas las futuras
  for (const cuota of cuotas.slice(1)) {
    assert.equal(dec(cuota.interes).toFixed(2), '50.00');
  }
  // pero el capital sí se reparte sobre el saldo real
  assert.equal(dec(cuotas[1].capital).toFixed(2), '183.33');
  await verificarInvarianteDeSaldo(prestamo.id);
});

test('pagar todo el cronograma deja el préstamo en PAGADO con saldo 0', async () => {
  const prestamo = await crearPrestamo();

  for (let i = 0; i < 4; i += 1) {
    const cuotas = await cuotasDe(prestamo.id);
    const pendiente = cuotas.find((cuota) => cuota.estado !== 'PAGADA');
    await pagosService.registrarPago({ cuotaId: pendiente.id, monto: pendiente.total }, admin.id);
  }

  const despues = await prisma.prestamo.findUnique({ where: { id: prestamo.id } });
  assert.equal(dec(despues.capitalPendiente).toFixed(2), '0.00');
  assert.equal(despues.estado, 'PAGADO');

  const cuotas = await cuotasDe(prestamo.id);
  assert.ok(cuotas.every((cuota) => cuota.estado === 'PAGADA'));
  assert.equal(dec(despues.interesAcumulado).toFixed(2), '125.00');
});

test('pagos sucesivos mantienen el invariante saldo = capital por cobrar', async () => {
  const prestamo = await crearPrestamo();

  const montos = [120, 90, 400, 33.33];
  for (const monto of montos) {
    const cuotas = await cuotasDe(prestamo.id);
    const objetivo = cuotas.find((cuota) => cuota.estado !== 'PAGADA');
    await pagosService.registrarPago({ cuotaId: objetivo.id, monto }, admin.id);
    await verificarInvarianteDeSaldo(prestamo.id);
  }
});

test('rechaza un pago que excede la deuda total del préstamo', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  await assert.rejects(
    () => pagosService.registrarPago({ cuotaId: cuota1.id, monto: 99999 }, admin.id),
    /excede la deuda pendiente/
  );

  // y el préstamo quedó intacto (la transacción revirtió)
  const despues = await prisma.prestamo.findUnique({ where: { id: prestamo.id } });
  assert.equal(dec(despues.capitalPendiente).toFixed(2), '1000.00');
});

test('rechaza pagar una cuota ya saldada', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  await pagosService.registrarPago({ cuotaId: cuota1.id, monto: 300 }, admin.id);

  await assert.rejects(
    () => pagosService.registrarPago({ cuotaId: cuota1.id, monto: 50 }, admin.id),
    /ya está pagada/
  );
});

test('cuotas fijas: pagar el cronograma completo lo deja saldado sin descuadres', async () => {
  const prestamo = await crearPrestamo('CUOTAS_FIJAS');

  const inicial = await cuotasDe(prestamo.id);
  // Todas iguales salvo la última, que ajusta céntimos
  assert.equal(dec(inicial[0].total).toFixed(2), '282.01');
  assert.equal(dec(inicial[1].total).toFixed(2), '282.01');

  for (let i = 0; i < 4; i += 1) {
    const cuotas = await cuotasDe(prestamo.id);
    const pendiente = cuotas.find((cuota) => cuota.estado !== 'PAGADA');
    await pagosService.registrarPago({ cuotaId: pendiente.id, monto: pendiente.total }, admin.id);
    await verificarInvarianteDeSaldo(prestamo.id);
  }

  const despues = await prisma.prestamo.findUnique({ where: { id: prestamo.id } });
  assert.equal(dec(despues.capitalPendiente).toFixed(2), '0.00');
  assert.equal(despues.estado, 'PAGADO');
  assert.equal(dec(despues.interesAcumulado).toFixed(2), '128.05');
});

test('cuotas fijas: un abono extra rehace la anualidad sobre el saldo restante', async () => {
  const prestamo = await crearPrestamo('CUOTAS_FIJAS');
  const cuotasAntes = await cuotasDe(prestamo.id);

  // Cuota 1 = 282.01 (50 interés + 232.01 capital). Paga 450: 167.99 de excedente.
  await pagosService.registrarPago({ cuotaId: cuotasAntes[0].id, monto: 450 }, admin.id);

  const despues = await prisma.prestamo.findUnique({ where: { id: prestamo.id } });
  assert.equal(dec(despues.capitalPendiente).toFixed(2), '600.00');

  const cuotas = await cuotasDe(prestamo.id);
  // Las 3 restantes vuelven a ser constantes, ahora sobre 600
  assert.equal(dec(cuotas[1].total).toFixed(2), '220.33');
  assert.equal(dec(cuotas[2].total).toFixed(2), '220.33');
  assert.ok(dec(cuotas[1].total).lt(dec(cuotasAntes[1].total)), 'la cuota debe bajar tras el abono');
  await verificarInvarianteDeSaldo(prestamo.id);
});

test('anularPago revierte un pago simple: el préstamo y la cuota vuelven al estado previo', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  const { pago } = await pagosService.registrarPago({ cuotaId: cuota1.id, monto: 300 }, admin.id);
  const { pago: anulado } = await pagosService.anularPago(pago.id, admin.id, 'Marcado por error');

  assert.equal(anulado.estado, 'ANULADO');
  assert.equal(anulado.motivoAnulacion, 'Marcado por error');
  assert.equal(anulado.recibo, null, 'el recibo debe desaparecer al anular');

  const despues = await prisma.prestamo.findUnique({ where: { id: prestamo.id } });
  assert.equal(dec(despues.capitalPendiente).toFixed(2), '1000.00');
  assert.equal(dec(despues.interesAcumulado).toFixed(2), '0.00');

  const [cuotaDespues] = await cuotasDe(prestamo.id);
  assert.equal(cuotaDespues.estado, 'PENDIENTE');
  assert.equal(dec(cuotaDespues.montoPagado).toFixed(2), '0.00');
  await verificarInvarianteDeSaldo(prestamo.id);
});

test('anularPago también revierte las cuotas futuras que se habían regenerado', async () => {
  const prestamo = await crearPrestamo('INTERES_SOBRE_SALDO');
  const cuotasAntes = await cuotasDe(prestamo.id);

  const { pago } = await pagosService.registrarPago({ cuotaId: cuotasAntes[0].id, monto: 500 }, admin.id);
  await pagosService.anularPago(pago.id, admin.id);

  const cuotasDespues = await cuotasDe(prestamo.id);
  assert.deepEqual(
    cuotasDespues.slice(1).map((c) => dec(c.interes).toFixed(2)),
    cuotasAntes.slice(1).map((c) => dec(c.interes).toFixed(2))
  );
  assert.deepEqual(
    cuotasDespues.slice(1).map((c) => dec(c.capital).toFixed(2)),
    cuotasAntes.slice(1).map((c) => dec(c.capital).toFixed(2))
  );
  await verificarInvarianteDeSaldo(prestamo.id);
});

test('anularPago no permite anular un pago que no es el más reciente del préstamo', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  const { pago: pago1 } = await pagosService.registrarPago({ cuotaId: cuota1.id, monto: 100 }, admin.id);
  const cuotas = await cuotasDe(prestamo.id);
  const pendiente = cuotas.find((c) => c.estado !== 'PAGADA');
  await pagosService.registrarPago({ cuotaId: pendiente.id, monto: 100 }, admin.id);

  await assert.rejects(() => pagosService.anularPago(pago1.id, admin.id), /más reciente/);
});

test('anularPago no permite anular un pago ya anulado', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  const { pago } = await pagosService.registrarPago({ cuotaId: cuota1.id, monto: 300 }, admin.id);
  await pagosService.anularPago(pago.id, admin.id);

  await assert.rejects(
    () => pagosService.anularPago(pago.id, admin.id),
    /Solo se puede anular un pago confirmado/
  );
});
