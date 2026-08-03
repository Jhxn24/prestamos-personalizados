const test = require('node:test');
const assert = require('node:assert/strict');
const Decimal = require('decimal.js');
const {
  recalcularPlazoReducido,
  recalcularCuotasPendientes,
  calcularCuotaFija,
  tasaPorCuota,
  ErrorMotorCalculo,
} = require('../../src/modules/motor-calculo');

const TASA = tasaPorCuota({ tasaInteres: 5, tipoInteres: 'MENSUAL', frecuenciaPago: 'MENSUAL' });

const sumar = (cuotas, campo) => cuotas.reduce((acc, c) => acc.plus(c[campo]), new Decimal(0));

/**
 * Préstamo de referencia: 1000 en 4 cuotas al 5%, capital de 250 por cuota.
 * El cliente abonó de más y el saldo quedó en 250 (le sobrarían 3 cuotas si se
 * mantuviera el plazo original).
 */
const BASE = {
  saldoInicial: 250,
  capitalARepartir: 250,
  capitalOriginal: 1000,
  capitalPorCuotaOriginal: 250,
  tasaPorCuota: TASA,
  modalidad: 'INTERES_SOBRE_SALDO',
};

test('reducir plazo: el saldo se liquida en una sola cuota del tamaño pactado', () => {
  const cuotas = recalcularPlazoReducido(BASE);

  assert.equal(cuotas.length, 1, 'de 3 cuotas restantes debe quedar 1');
  assert.equal(cuotas[0].capital.toFixed(2), '250.00');
  assert.equal(cuotas[0].interes.toFixed(2), '12.50');
  assert.equal(cuotas[0].saldoCapital.toFixed(2), '0.00');
});

test('la diferencia con reducir cuota: mismo saldo, distinto reparto', () => {
  const plazo = recalcularPlazoReducido(BASE);
  const cuota = recalcularCuotasPendientes({ ...BASE, numeroCuotasPendientes: 3 });

  // Reducir plazo: 1 cuota grande. Reducir cuota: 3 cuotas pequeñas.
  assert.equal(plazo.length, 1);
  assert.equal(cuota.length, 3);
  assert.equal(plazo[0].capital.toFixed(2), '250.00');
  assert.equal(cuota[0].capital.toFixed(2), '83.33');

  // Ambas amortizan exactamente el mismo capital
  assert.equal(sumar(plazo, 'capital').toFixed(2), sumar(cuota, 'capital').toFixed(2));
});

test('reducir plazo cobra menos interés total, porque la deuda vive menos tiempo', () => {
  const plazo = recalcularPlazoReducido(BASE);
  const cuota = recalcularCuotasPendientes({ ...BASE, numeroCuotasPendientes: 3 });

  assert.equal(sumar(plazo, 'interes').toFixed(2), '12.50');
  assert.equal(sumar(cuota, 'interes').toFixed(2), '25.00');
  assert.ok(sumar(plazo, 'interes').lt(sumar(cuota, 'interes')));
});

test('la última cuota queda corta cuando el saldo no es múltiplo de la cuota', () => {
  const cuotas = recalcularPlazoReducido({
    ...BASE,
    saldoInicial: 600,
    capitalARepartir: 600,
  });

  // 600 a razón de 250 por cuota: 250 + 250 + 100
  assert.equal(cuotas.length, 3);
  assert.deepEqual(cuotas.map((c) => c.capital.toFixed(2)), ['250.00', '250.00', '100.00']);
  assert.equal(sumar(cuotas, 'capital').toFixed(2), '600.00');
  assert.equal(cuotas.at(-1).saldoCapital.toFixed(2), '0.00');
});

test('sobre saldo: el interés sigue el saldo real cuota a cuota', () => {
  const cuotas = recalcularPlazoReducido({ ...BASE, saldoInicial: 600, capitalARepartir: 600 });

  // 5% de 600, luego de 350, luego de 100
  assert.deepEqual(cuotas.map((c) => c.interes.toFixed(2)), ['30.00', '17.50', '5.00']);
});

test('interés fijo: el interés por cuota no cambia al acortar el plazo', () => {
  const cuotas = recalcularPlazoReducido({
    ...BASE,
    saldoInicial: 600,
    capitalARepartir: 600,
    modalidad: 'INTERES_FIJO',
  });

  // 5% del capital ORIGINAL (1000) en todas
  assert.deepEqual(cuotas.map((c) => c.interes.toFixed(2)), ['50.00', '50.00', '50.00']);
  // pero se pagan 3 cuotas en vez de 3 más largas
  assert.equal(sumar(cuotas, 'capital').toFixed(2), '600.00');
});

test('cuotas fijas: se conserva el importe de la anualidad y bajan los periodos', () => {
  const cuotaFijaOriginal = calcularCuotaFija({ capital: 1000, tasaPorCuota: TASA, numeroCuotas: 4 });
  assert.equal(cuotaFijaOriginal.toFixed(2), '282.01');

  const cuotas = recalcularPlazoReducido({
    saldoInicial: 500,
    capitalARepartir: 500,
    capitalOriginal: 1000,
    capitalPorCuotaOriginal: 250,
    cuotaFijaOriginal,
    tasaPorCuota: TASA,
    modalidad: 'CUOTAS_FIJAS',
  });

  // 500 al 5% con cuota de 282.01: dos periodos
  assert.equal(cuotas.length, 2);
  assert.equal(cuotas[0].total.toFixed(2), '282.01');
  assert.equal(sumar(cuotas, 'capital').toFixed(2), '500.00');
  assert.equal(cuotas.at(-1).saldoCapital.toFixed(2), '0.00');
});

test('cuotas fijas: la última cuota es menor, nunca mayor que la pactada', () => {
  const cuotaFijaOriginal = calcularCuotaFija({ capital: 1000, tasaPorCuota: TASA, numeroCuotas: 4 });

  const cuotas = recalcularPlazoReducido({
    saldoInicial: 700,
    capitalARepartir: 700,
    capitalOriginal: 1000,
    capitalPorCuotaOriginal: 250,
    cuotaFijaOriginal,
    tasaPorCuota: TASA,
    modalidad: 'CUOTAS_FIJAS',
  });

  assert.ok(cuotas.at(-1).total.lte(cuotaFijaOriginal), 'la última no puede exceder la cuota pactada');
  assert.equal(sumar(cuotas, 'capital').toFixed(2), '700.00');
});

test('cuotas fijas: rechaza un préstamo cuya cuota no cubre el interés', () => {
  assert.throws(
    () =>
      recalcularPlazoReducido({
        saldoInicial: 10000,
        capitalARepartir: 10000,
        capitalOriginal: 10000,
        capitalPorCuotaOriginal: 1000,
        cuotaFijaOriginal: 100, // 100 < 10 000 x 5% = 500 de interés
        tasaPorCuota: TASA,
        modalidad: 'CUOTAS_FIJAS',
      }),
    ErrorMotorCalculo
  );
});

test('saldo cero no genera ninguna cuota: el préstamo quedó liquidado', () => {
  const cuotas = recalcularPlazoReducido({ ...BASE, saldoInicial: 0, capitalARepartir: 0 });
  assert.deepEqual(cuotas, []);
});

test('nunca alarga el préstamo: se comprime en las cuotas disponibles', () => {
  // Harían falta 4 cuotas de 250, pero solo quedan 2 disponibles
  const cuotas = recalcularPlazoReducido({
    ...BASE,
    saldoInicial: 1000,
    capitalARepartir: 1000,
    maximoCuotas: 2,
  });

  assert.equal(cuotas.length, 2);
  assert.equal(sumar(cuotas, 'capital').toFixed(2), '1000.00');
  assert.equal(cuotas.at(-1).saldoCapital.toFixed(2), '0.00');
});

test('el tope no interfiere cuando el plazo natural ya cabe', () => {
  const cuotas = recalcularPlazoReducido({ ...BASE, maximoCuotas: 3 });

  assert.equal(cuotas.length, 1, 'no debe rellenar hasta el máximo');
});

test('rechaza un capital por cuota inválido en vez de colgarse', () => {
  assert.throws(
    () => recalcularPlazoReducido({ ...BASE, capitalPorCuotaOriginal: 0 }),
    /capital por cuota/
  );
});

test('cada cuota cuadra y el saldo decrece de forma monótona', () => {
  const cuotas = recalcularPlazoReducido({ ...BASE, saldoInicial: 875.55, capitalARepartir: 875.55 });

  assert.equal(sumar(cuotas, 'capital').toFixed(2), '875.55');
  for (let i = 0; i < cuotas.length; i += 1) {
    assert.equal(cuotas[i].capital.plus(cuotas[i].interes).toFixed(2), cuotas[i].total.toFixed(2));
    if (i > 0) {
      assert.ok(cuotas[i].saldoCapital.lt(cuotas[i - 1].saldoCapital));
    }
  }
  assert.equal(cuotas.at(-1).saldoCapital.toFixed(2), '0.00');
});
