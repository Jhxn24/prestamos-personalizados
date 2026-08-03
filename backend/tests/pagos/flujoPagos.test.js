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
      apellido: 'Pagos',
      documento: SUFIJO,
      usuario: { create: { email: `cliente-${SUFIJO}@test.local`, password: 'x', rol: 'CLIENTE' } },
    },
    include: { usuario: true },
  });
  usuarioCliente = cliente.usuario;
});

test.after(async () => {
  await prisma.recibo.deleteMany({ where: { pago: { prestamo: { clienteId: cliente.id } } } });
  await prisma.pago.deleteMany({ where: { prestamo: { clienteId: cliente.id } } });
  await prisma.prestamo.updateMany({ where: { clienteId: cliente.id }, data: { prestamoOrigenId: null } });
  await prisma.prestamo.deleteMany({ where: { clienteId: cliente.id } });
  await prisma.cliente.delete({ where: { id: cliente.id } });
  await prisma.usuario.deleteMany({ where: { id: { in: [admin.id, usuarioCliente.id] } } });
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

test('RF-22: el pago reportado por el cliente NO toca el préstamo hasta confirmarse', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  const { pago } = await pagosService.registrarPago(
    { cuotaId: cuota1.id, monto: 300, comprobanteUrl: 'https://ejemplo/comprobante.jpg' },
    usuarioCliente
  );

  assert.equal(pago.estado, 'PENDIENTE_CONFIRMACION');
  assert.equal(pago.recibo, null, 'no debe emitirse recibo antes de confirmar');

  const despues = await prisma.prestamo.findUnique({ where: { id: prestamo.id } });
  assert.equal(dec(despues.capitalPendiente).toFixed(2), '1000.00');

  const [cuotaDespues] = await cuotasDe(prestamo.id);
  assert.equal(cuotaDespues.estado, 'PENDIENTE');
  assert.equal(dec(cuotaDespues.montoPagado).toFixed(2), '0.00');
});

test('RF-23 y RF-24: al confirmar se aplica el pago y se emite el recibo', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  const { pago } = await pagosService.registrarPago({ cuotaId: cuota1.id, monto: 300 }, usuarioCliente);
  const { pago: confirmado } = await pagosService.confirmarPago(pago.id, admin.id);

  assert.equal(confirmado.estado, 'CONFIRMADO');
  assert.equal(dec(confirmado.interesAplicado).toFixed(2), '50.00');
  assert.equal(dec(confirmado.capitalAplicado).toFixed(2), '250.00');
  assert.ok(confirmado.recibo, 'debe existir un recibo');
  assert.equal(dec(confirmado.recibo.monto).toFixed(2), '300.00');

  const despues = await prisma.prestamo.findUnique({ where: { id: prestamo.id } });
  assert.equal(dec(despues.capitalPendiente).toFixed(2), '750.00');
  assert.equal(dec(despues.interesAcumulado).toFixed(2), '50.00');

  const cuotas = await cuotasDe(prestamo.id);
  assert.equal(cuotas[0].estado, 'PAGADA');
  await verificarInvarianteDeSaldo(prestamo.id);
});

test('RF-25: el pago registrado por el administrador se confirma y aplica en el acto', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  const { pago } = await pagosService.registrarPago(
    { cuotaId: cuota1.id, monto: 300, metodo: 'EFECTIVO' },
    admin
  );

  assert.equal(pago.estado, 'CONFIRMADO');
  assert.ok(pago.recibo);

  const despues = await prisma.prestamo.findUnique({ where: { id: prestamo.id } });
  assert.equal(dec(despues.capitalPendiente).toFixed(2), '750.00');
});

test('RF-15: un pago parcial deja la cuota PARCIAL y baja el saldo solo lo abonado', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  await pagosService.registrarPago({ cuotaId: cuota1.id, monto: 150 }, admin);

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

  await pagosService.registrarPago({ cuotaId: cuota1.id, monto: 50 }, admin);

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
  await pagosService.registrarPago({ cuotaId: cuotasAntes[0].id, monto: 500 }, admin);

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

  await pagosService.registrarPago({ cuotaId: cuotasAntes[0].id, monto: 500 }, admin);

  const cuotas = await cuotasDe(prestamo.id);
  // El interés sigue siendo 5% del capital ORIGINAL (1000) en todas las futuras
  for (const cuota of cuotas.slice(1)) {
    assert.equal(dec(cuota.interes).toFixed(2), '50.00');
  }
  // pero el capital sí se reparte sobre el saldo real
  assert.equal(dec(cuotas[1].capital).toFixed(2), '183.33');
  await verificarInvarianteDeSaldo(prestamo.id);
});

test('el pago rechazado no mueve nada de la contabilidad', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  const { pago } = await pagosService.registrarPago({ cuotaId: cuota1.id, monto: 300 }, usuarioCliente);
  const { pago: rechazado } = await pagosService.rechazarPago(pago.id, admin.id, 'Comprobante ilegible');

  assert.equal(rechazado.estado, 'RECHAZADO');
  assert.equal(rechazado.motivoRechazo, 'Comprobante ilegible');
  assert.equal(rechazado.recibo, null);

  const despues = await prisma.prestamo.findUnique({ where: { id: prestamo.id } });
  assert.equal(dec(despues.capitalPendiente).toFixed(2), '1000.00');
  assert.equal(dec(despues.interesAcumulado).toFixed(2), '0.00');
});

test('pagar todo el cronograma deja el préstamo en PAGADO con saldo 0', async () => {
  const prestamo = await crearPrestamo();

  for (let i = 0; i < 4; i += 1) {
    const cuotas = await cuotasDe(prestamo.id);
    const pendiente = cuotas.find((cuota) => cuota.estado !== 'PAGADA');
    await pagosService.registrarPago({ cuotaId: pendiente.id, monto: pendiente.total }, admin);
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
    await pagosService.registrarPago({ cuotaId: objetivo.id, monto }, admin);
    await verificarInvarianteDeSaldo(prestamo.id);
  }
});

test('rechaza un pago que excede la deuda total del préstamo', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  await assert.rejects(
    () => pagosService.registrarPago({ cuotaId: cuota1.id, monto: 99999 }, admin),
    /excede la deuda pendiente/
  );

  // y el préstamo quedó intacto (la transacción revirtió)
  const despues = await prisma.prestamo.findUnique({ where: { id: prestamo.id } });
  assert.equal(dec(despues.capitalPendiente).toFixed(2), '1000.00');
});

test('rechaza pagar una cuota ya saldada', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  await pagosService.registrarPago({ cuotaId: cuota1.id, monto: 300 }, admin);

  await assert.rejects(
    () => pagosService.registrarPago({ cuotaId: cuota1.id, monto: 50 }, admin),
    /ya está pagada/
  );
});

test('RNF-05: un cliente no puede pagar la cuota de otro préstamo ajeno', async () => {
  const otro = await prisma.cliente.create({
    data: {
      nombre: 'Ajeno',
      apellido: 'Test',
      documento: `${SUFIJO}-ajeno`,
      usuario: { create: { email: `ajeno-${SUFIJO}@test.local`, password: 'x', rol: 'CLIENTE' } },
    },
  });

  const prestamoAjeno = await prestamosService.crearPrestamo({
    clienteId: otro.id,
    capital: 500,
    tasaInteres: 5,
    tipoInteres: 'MENSUAL',
    frecuenciaPago: 'MENSUAL',
    numeroCuotas: 2,
    modalidad: 'INTERES_FIJO',
    fechaDesembolso: new Date(),
  });

  const [cuotaAjena] = await cuotasDe(prestamoAjeno.id);
  const resultado = await pagosService.registrarPago({ cuotaId: cuotaAjena.id, monto: 100 }, usuarioCliente);

  assert.equal(resultado.error, 'SIN_ACCESO');

  await prisma.prestamo.delete({ where: { id: prestamoAjeno.id } });
  await prisma.cliente.delete({ where: { id: otro.id } });
  await prisma.usuario.delete({ where: { id: otro.usuarioId } });
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
    await pagosService.registrarPago({ cuotaId: pendiente.id, monto: pendiente.total }, admin);
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
  await pagosService.registrarPago({ cuotaId: cuotasAntes[0].id, monto: 450 }, admin);

  const despues = await prisma.prestamo.findUnique({ where: { id: prestamo.id } });
  assert.equal(dec(despues.capitalPendiente).toFixed(2), '600.00');

  const cuotas = await cuotasDe(prestamo.id);
  // Las 3 restantes vuelven a ser constantes, ahora sobre 600
  assert.equal(dec(cuotas[1].total).toFixed(2), '220.33');
  assert.equal(dec(cuotas[2].total).toFixed(2), '220.33');
  assert.ok(dec(cuotas[1].total).lt(dec(cuotasAntes[1].total)), 'la cuota debe bajar tras el abono');
  await verificarInvarianteDeSaldo(prestamo.id);
});

test('no se puede confirmar dos veces el mismo pago', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  const { pago } = await pagosService.registrarPago({ cuotaId: cuota1.id, monto: 300 }, usuarioCliente);
  await pagosService.confirmarPago(pago.id, admin.id);

  await assert.rejects(() => pagosService.confirmarPago(pago.id, admin.id), /Solo se puede confirmar/);

  // el saldo refleja UN solo pago, no dos
  const despues = await prisma.prestamo.findUnique({ where: { id: prestamo.id } });
  assert.equal(dec(despues.capitalPendiente).toFixed(2), '750.00');
});
