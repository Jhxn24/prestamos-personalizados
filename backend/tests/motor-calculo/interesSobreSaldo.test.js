const test = require('node:test');
const assert = require('node:assert/strict');
const { generarCronograma } = require('../../src/modules/motor-calculo');

const BASE = {
  capital: 1000,
  tasaInteres: 5,
  tipoInteres: 'MENSUAL',
  frecuenciaPago: 'MENSUAL',
  numeroCuotas: 4,
  modalidad: 'INTERES_SOBRE_SALDO',
  fechaDesembolso: new Date(Date.UTC(2026, 0, 15)),
};

test('el interés se calcula sobre el saldo pendiente y decrece cada cuota', () => {
  const { cuotas } = generarCronograma(BASE);

  // saldos antes de cada cuota: 1000, 750, 500, 250 -> 5% de cada uno
  assert.deepEqual(
    cuotas.map((c) => c.interes.toString()),
    ['50', '37.5', '25', '12.5']
  );
});

test('el capital se amortiza igual que en interés fijo', () => {
  const { cuotas } = generarCronograma(BASE);

  for (const cuota of cuotas) {
    assert.equal(cuota.capital.toString(), '250');
  }
});

test('la cuota total decrece porque el interés baja (RF-13)', () => {
  const { cuotas } = generarCronograma(BASE);

  assert.deepEqual(
    cuotas.map((c) => c.total.toString()),
    ['300', '287.5', '275', '262.5']
  );
});

test('cobra menos interés total que la modalidad de interés fijo', () => {
  const sobreSaldo = generarCronograma(BASE);
  const fijo = generarCronograma({ ...BASE, modalidad: 'INTERES_FIJO' });

  assert.equal(sobreSaldo.resumen.totalInteres.toString(), '125');
  assert.equal(fijo.resumen.totalInteres.toString(), '200');
  assert.ok(sobreSaldo.resumen.totalInteres.lt(fijo.resumen.totalInteres));
});

test('el saldo llega exactamente a 0 y el capital total cuadra', () => {
  const { cuotas, resumen } = generarCronograma(BASE);

  assert.equal(cuotas.at(-1).saldoCapital.toString(), '0');
  assert.equal(resumen.totalCapital.toString(), '1000');
});

test('con capital indivisible el interés sigue el saldo real, no el teórico', () => {
  const { cuotas, resumen } = generarCronograma({ ...BASE, numeroCuotas: 3 });

  // saldos: 1000 -> 666.67 -> 333.34 -> 0
  assert.deepEqual(
    cuotas.map((c) => c.saldoCapital.toString()),
    ['666.67', '333.34', '0']
  );
  // el interés de la cuota 2 usa 666.67 (saldo real tras redondeo), no 666.666...
  assert.equal(cuotas[1].interes.toString(), '33.33');
  assert.equal(cuotas[2].interes.toString(), '16.67');
  assert.equal(resumen.totalCapital.toString(), '1000');
});

test('la primera cuota siempre cobra interés sobre el capital completo', () => {
  const { cuotas } = generarCronograma({ ...BASE, numeroCuotas: 12 });
  assert.equal(cuotas[0].interes.toString(), '50');
});

test('préstamo diario de alta frecuencia mantiene el saldo cuadrado', () => {
  const { cuotas, resumen } = generarCronograma({
    ...BASE,
    capital: 500,
    tasaInteres: 30,
    frecuenciaPago: 'DIARIA',
    numeroCuotas: 30,
  });

  assert.equal(cuotas.length, 30);
  assert.equal(resumen.totalCapital.toString(), '500');
  assert.equal(cuotas.at(-1).saldoCapital.toString(), '0');
  // 30% mensual / 30 días = 1% diario sobre 500 = 5 en la primera cuota
  assert.equal(cuotas[0].interes.toString(), '5');
});

test('sin interés se comporta igual que interés fijo sin interés', () => {
  const sobreSaldo = generarCronograma({ ...BASE, tasaInteres: 0 });
  const fijo = generarCronograma({ ...BASE, tasaInteres: 0, modalidad: 'INTERES_FIJO' });

  assert.deepEqual(
    sobreSaldo.cuotas.map((c) => c.total.toString()),
    fijo.cuotas.map((c) => c.total.toString())
  );
});
