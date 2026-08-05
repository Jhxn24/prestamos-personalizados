const test = require('node:test');
const assert = require('node:assert/strict');
const Decimal = require('decimal.js');
const { generarCronograma } = require('../../src/modules/motor-calculo');

const BASE = {
  capital: 1000,
  tasaInteres: 5,
  tipoInteres: 'MENSUAL',
  frecuenciaPago: 'MENSUAL',
  numeroCuotas: 4,
  modalidad: 'CAPITAL_AL_FINAL',
  fechaDesembolso: new Date(Date.UTC(2026, 0, 15)),
};

test('ejemplo real: S/1800 a 2 meses, mes 1 solo interés, mes 2 capital + interés', () => {
  const { cuotas } = generarCronograma({ ...BASE, capital: 1800, numeroCuotas: 2 });

  assert.equal(cuotas.length, 2);
  assert.equal(cuotas[0].capital.toString(), '0');
  assert.equal(cuotas[0].interes.toString(), '90');
  assert.equal(cuotas[0].total.toString(), '90');
  assert.equal(cuotas[0].saldoCapital.toString(), '1800');

  assert.equal(cuotas[1].capital.toString(), '1800');
  assert.equal(cuotas[1].interes.toString(), '90');
  assert.equal(cuotas[1].total.toString(), '1890');
  assert.equal(cuotas[1].saldoCapital.toString(), '0');
});

test('todas las cuotas intermedias son solo interés (capital en 0)', () => {
  const { cuotas } = generarCronograma(BASE);

  for (const cuota of cuotas.slice(0, -1)) {
    assert.equal(cuota.capital.toString(), '0');
  }
});

test('la última cuota concentra el 100% del capital', () => {
  const { cuotas } = generarCronograma(BASE);
  assert.equal(cuotas.at(-1).capital.toString(), '1000');
});

test('el interés es constante y se calcula sobre el capital inicial en todas las cuotas', () => {
  const { cuotas } = generarCronograma(BASE);

  for (const cuota of cuotas) {
    assert.equal(cuota.interes.toString(), '50');
  }
});

test('el saldo de capital se mantiene en el capital inicial hasta la última cuota', () => {
  const { cuotas } = generarCronograma(BASE);

  assert.deepEqual(
    cuotas.map((c) => c.saldoCapital.toString()),
    ['1000', '1000', '1000', '0']
  );
});

test('la suma del capital amortizado es exactamente el capital prestado', () => {
  const { cuotas, resumen } = generarCronograma(BASE);

  const sumaCapital = cuotas.reduce((acc, c) => acc.plus(c.capital), new Decimal(0));
  assert.equal(sumaCapital.toString(), '1000');
  assert.equal(resumen.totalCapital.toString(), '1000');
  assert.equal(resumen.totalInteres.toString(), '200');
  assert.equal(resumen.totalAPagar.toString(), '1200');
});

test('el interés se redondea a 2 decimales por cuota', () => {
  // 1000 * (5/30*7)% = 11.6666... -> 11.67
  const { cuotas } = generarCronograma({ ...BASE, frecuenciaPago: 'SEMANAL' });
  for (const cuota of cuotas) {
    assert.equal(cuota.interes.toString(), '11.67');
  }
});

test('una sola cuota concentra todo el capital y un periodo de interés (degenera igual que las otras modalidades)', () => {
  const { cuotas, resumen } = generarCronograma({ ...BASE, numeroCuotas: 1 });

  assert.equal(cuotas.length, 1);
  assert.equal(cuotas[0].capital.toString(), '1000');
  assert.equal(cuotas[0].interes.toString(), '50');
  assert.equal(cuotas[0].saldoCapital.toString(), '0');
  assert.equal(resumen.totalAPagar.toString(), '1050');
});

test('capital con céntimos se respeta sin distorsión', () => {
  const { resumen } = generarCronograma({ ...BASE, capital: '1500.55', numeroCuotas: 3 });
  assert.equal(resumen.totalCapital.toString(), '1500.55');
});
