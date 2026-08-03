const test = require('node:test');
const assert = require('node:assert/strict');
const Decimal = require('decimal.js');
const { recalcularCuotasPendientes, tasaPorCuota } = require('../../src/modules/motor-calculo');

const TASA_5_MENSUAL = tasaPorCuota({ tasaInteres: 5, tipoInteres: 'MENSUAL', frecuenciaPago: 'MENSUAL' });

/**
 * Este es el corazón de RF-11/RF-13: tras cada pago confirmado, el cronograma
 * futuro debe reflejar el saldo REAL, no el que se proyectó al firmar.
 */

test('sobre saldo: al abonar capital de más, el interés futuro baja', () => {
  // Préstamo de 1000 en 4 cuotas. Tras la cuota 1 el cliente abonó capital extra
  // y el saldo quedó en 600 (en vez de los 750 proyectados).
  const cuotas = recalcularCuotasPendientes({
    saldoInicial: 600,
    capitalARepartir: 600,
    capitalOriginal: 1000,
    tasaPorCuota: TASA_5_MENSUAL,
    modalidad: 'INTERES_SOBRE_SALDO',
    numeroCuotasPendientes: 3,
  });

  // interés sobre 600, luego 400, luego 200
  assert.deepEqual(cuotas.map((c) => c.interes.toString()), ['30', '20', '10']);
  assert.deepEqual(cuotas.map((c) => c.capital.toString()), ['200', '200', '200']);
  assert.equal(cuotas.at(-1).saldoCapital.toString(), '0');
});

test('sobre saldo: si el saldo es mayor al proyectado, el interés futuro sube', () => {
  const cuotas = recalcularCuotasPendientes({
    saldoInicial: 900,
    capitalARepartir: 900,
    capitalOriginal: 1000,
    tasaPorCuota: TASA_5_MENSUAL,
    modalidad: 'INTERES_SOBRE_SALDO',
    numeroCuotasPendientes: 3,
  });

  assert.equal(cuotas[0].interes.toString(), '45');
  assert.equal(cuotas[0].capital.toString(), '300');
});

test('interés fijo: abonar capital NO reduce el interés de las cuotas futuras', () => {
  const cuotas = recalcularCuotasPendientes({
    saldoInicial: 600,
    capitalARepartir: 600,
    capitalOriginal: 1000,
    tasaPorCuota: TASA_5_MENSUAL,
    modalidad: 'INTERES_FIJO',
    numeroCuotasPendientes: 3,
  });

  // 5% de 1000 (capital ORIGINAL) en todas, aunque el saldo sea 600
  assert.deepEqual(cuotas.map((c) => c.interes.toString()), ['50', '50', '50']);
  // pero el capital sí se reparte sobre el saldo real
  assert.deepEqual(cuotas.map((c) => c.capital.toString()), ['200', '200', '200']);
});

test('la diferencia entre modalidades es exactamente lo que cobra de más el interés fijo', () => {
  const parametros = {
    saldoInicial: 600,
    capitalARepartir: 600,
    capitalOriginal: 1000,
    tasaPorCuota: TASA_5_MENSUAL,
    numeroCuotasPendientes: 3,
  };

  const sumaInteres = (cuotas) => cuotas.reduce((acc, c) => acc.plus(c.interes), new Decimal(0));

  const fijo = sumaInteres(recalcularCuotasPendientes({ ...parametros, modalidad: 'INTERES_FIJO' }));
  const saldo = sumaInteres(recalcularCuotasPendientes({ ...parametros, modalidad: 'INTERES_SOBRE_SALDO' }));

  assert.equal(fijo.toString(), '150');
  assert.equal(saldo.toString(), '60');
  assert.ok(saldo.lt(fijo));
});

test('el capital repartido suma exactamente el saldo, aunque sea indivisible', () => {
  const cuotas = recalcularCuotasPendientes({
    saldoInicial: 1000,
    capitalARepartir: 1000,
    capitalOriginal: 1000,
    tasaPorCuota: TASA_5_MENSUAL,
    modalidad: 'INTERES_SOBRE_SALDO',
    numeroCuotasPendientes: 3,
  });

  const suma = cuotas.reduce((acc, c) => acc.plus(c.capital), new Decimal(0));
  assert.equal(suma.toString(), '1000');
  assert.equal(cuotas.at(-1).saldoCapital.toString(), '0');
});

test('capitalARepartir puede ser menor al saldo si una cuota anterior quedó parcial', () => {
  // Saldo real 600, pero 100 de ese capital lo sigue debiendo una cuota parcial
  // anterior: las cuotas futuras solo amortizan 500...
  const cuotas = recalcularCuotasPendientes({
    saldoInicial: 600,
    capitalARepartir: 500,
    capitalOriginal: 1000,
    tasaPorCuota: TASA_5_MENSUAL,
    modalidad: 'INTERES_SOBRE_SALDO',
    numeroCuotasPendientes: 2,
  });

  // ...pero el interés se cobra sobre el saldo REAL de 600, no sobre 500
  assert.equal(cuotas[0].interes.toString(), '30');
  assert.deepEqual(cuotas.map((c) => c.capital.toString()), ['250', '250']);
  // el remanente de 100 queda a cargo de la cuota parcial anterior
  assert.equal(cuotas.at(-1).saldoCapital.toString(), '100');
});

test('sin cuotas pendientes devuelve lista vacía en vez de fallar', () => {
  const cuotas = recalcularCuotasPendientes({
    saldoInicial: 0,
    capitalARepartir: 0,
    capitalOriginal: 1000,
    tasaPorCuota: TASA_5_MENSUAL,
    modalidad: 'INTERES_SOBRE_SALDO',
    numeroCuotasPendientes: 0,
  });

  assert.deepEqual(cuotas, []);
});

test('saldo en cero genera cuotas sin interés ni capital', () => {
  const cuotas = recalcularCuotasPendientes({
    saldoInicial: 0,
    capitalARepartir: 0,
    capitalOriginal: 1000,
    tasaPorCuota: TASA_5_MENSUAL,
    modalidad: 'INTERES_SOBRE_SALDO',
    numeroCuotasPendientes: 2,
  });

  assert.deepEqual(cuotas.map((c) => c.total.toString()), ['0', '0']);
});

test('una única cuota pendiente concentra todo el saldo restante', () => {
  const cuotas = recalcularCuotasPendientes({
    saldoInicial: 333.34,
    capitalARepartir: 333.34,
    capitalOriginal: 1000,
    tasaPorCuota: TASA_5_MENSUAL,
    modalidad: 'INTERES_SOBRE_SALDO',
    numeroCuotasPendientes: 1,
  });

  assert.equal(cuotas[0].capital.toString(), '333.34');
  assert.equal(cuotas[0].interes.toString(), '16.67');
  assert.equal(cuotas[0].saldoCapital.toString(), '0');
});
