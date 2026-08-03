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
  modalidad: 'INTERES_FIJO',
  fechaDesembolso: new Date(Date.UTC(2026, 0, 15)),
};

test('el interés es constante y se calcula sobre el capital INICIAL', () => {
  const { cuotas } = generarCronograma(BASE);

  // 1000 * 5% = 50 en TODAS las cuotas, aunque el saldo baje
  for (const cuota of cuotas) {
    assert.equal(cuota.interes.toString(), '50');
  }
});

test('el capital se amortiza en partes iguales', () => {
  const { cuotas } = generarCronograma(BASE);

  for (const cuota of cuotas) {
    assert.equal(cuota.capital.toString(), '250');
    assert.equal(cuota.total.toString(), '300');
  }
});

test('el saldo de capital decrece hasta exactamente 0', () => {
  const { cuotas } = generarCronograma(BASE);

  assert.deepEqual(
    cuotas.map((c) => c.saldoCapital.toString()),
    ['750', '500', '250', '0']
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

test('capital no divisible entre las cuotas cuadra al céntimo (invariante de dinero)', () => {
  // 1000 / 3 = 333.333... -> el residuo NO puede evaporarse
  const { cuotas, resumen } = generarCronograma({ ...BASE, numeroCuotas: 3 });

  assert.deepEqual(
    cuotas.map((c) => c.capital.toString()),
    ['333.33', '333.33', '333.34']
  );
  assert.equal(resumen.totalCapital.toString(), '1000');
  assert.equal(cuotas.at(-1).saldoCapital.toString(), '0');
});

test('capital con residuo grande sigue cuadrando (7 cuotas)', () => {
  const { cuotas, resumen } = generarCronograma({ ...BASE, capital: 1000, numeroCuotas: 7 });

  assert.equal(resumen.totalCapital.toString(), '1000');
  assert.equal(cuotas.at(-1).saldoCapital.toString(), '0');
  // 1000/7 = 142.857... -> 142.85 x 7 = 999.95, la última absorbe 0.05
  assert.equal(cuotas[0].capital.toFixed(2), '142.85');
  assert.equal(cuotas.at(-1).capital.toFixed(2), '142.90');
});

test('el interés se redondea a 2 decimales por cuota', () => {
  // 1000 * (5/30*7)% = 11.6666... -> 11.67
  const { cuotas } = generarCronograma({ ...BASE, frecuenciaPago: 'SEMANAL' });
  assert.equal(cuotas[0].interes.toString(), '11.67');
});

test('préstamo sin interés genera cronograma de solo capital', () => {
  const { cuotas, resumen } = generarCronograma({ ...BASE, tasaInteres: 0 });

  assert.equal(resumen.totalInteres.toString(), '0');
  assert.equal(resumen.totalAPagar.toString(), '1000');
  assert.equal(cuotas[0].total.toString(), '250');
});

test('una sola cuota concentra todo el capital y un periodo de interés', () => {
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
