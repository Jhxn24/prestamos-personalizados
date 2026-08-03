const test = require('node:test');
const assert = require('node:assert/strict');
const Decimal = require('decimal.js');
const {
  generarCronograma,
  calcularCuotaFija,
  recalcularCuotasPendientes,
  tasaPorCuota,
} = require('../../src/modules/motor-calculo');

const BASE = {
  capital: 1000,
  tasaInteres: 5,
  tipoInteres: 'MENSUAL',
  frecuenciaPago: 'MENSUAL',
  numeroCuotas: 4,
  modalidad: 'CUOTAS_FIJAS',
  fechaDesembolso: new Date(Date.UTC(2026, 0, 15)),
};

const sumar = (cuotas, campo) => cuotas.reduce((acc, c) => acc.plus(c[campo]), new Decimal(0));

// ------------------------------------------------- la fórmula de anualidad

test('la cuota sale de la fórmula francesa C = P·i/(1−(1+i)⁻ⁿ)', () => {
  // 1000 al 5% en 4 cuotas: 1000 × 0.05 / (1 − 1.05⁻⁴) = 282.01
  const cuota = calcularCuotaFija({ capital: 1000, tasaPorCuota: 0.05, numeroCuotas: 4 });
  assert.equal(cuota.toFixed(2), '282.01');
});

test('reproduce el valor clásico de manual: 10 000 al 1% en 12 cuotas = 888.49', () => {
  const cuota = calcularCuotaFija({ capital: 10000, tasaPorCuota: 0.01, numeroCuotas: 12 });
  assert.equal(cuota.toFixed(2), '888.49');
});

test('sin interés la cuota es el capital dividido entre el plazo (evita 0/0)', () => {
  const cuota = calcularCuotaFija({ capital: 1200, tasaPorCuota: 0, numeroCuotas: 12 });
  assert.equal(cuota.toFixed(2), '100.00');
});

test('una sola cuota equivale a capital más un periodo de interés', () => {
  const cuota = calcularCuotaFija({ capital: 1000, tasaPorCuota: 0.05, numeroCuotas: 1 });
  assert.equal(cuota.toFixed(2), '1050.00');
});

// ------------------------------------------------------ tabla de amortización

test('todas las cuotas valen lo mismo salvo la última, que ajusta céntimos', () => {
  const { cuotas } = generarCronograma(BASE);

  assert.deepEqual(
    cuotas.map((c) => c.total.toFixed(2)),
    ['282.01', '282.01', '282.01', '282.02']
  );
});

test('la composición se invierte: el interés cae y el capital sube', () => {
  const { cuotas } = generarCronograma(BASE);

  assert.deepEqual(
    cuotas.map((c) => c.interes.toFixed(2)),
    ['50.00', '38.40', '26.22', '13.43']
  );
  assert.deepEqual(
    cuotas.map((c) => c.capital.toFixed(2)),
    ['232.01', '243.61', '255.79', '268.59']
  );

  for (let i = 1; i < cuotas.length; i += 1) {
    assert.ok(cuotas[i].interes.lt(cuotas[i - 1].interes), 'el interés debe decrecer');
    assert.ok(cuotas[i].capital.gt(cuotas[i - 1].capital), 'el capital debe crecer');
  }
});

test('el capital amortizado suma exactamente el capital prestado', () => {
  const { cuotas, resumen } = generarCronograma(BASE);

  assert.equal(sumar(cuotas, 'capital').toFixed(2), '1000.00');
  assert.equal(resumen.totalCapital.toFixed(2), '1000.00');
  assert.equal(cuotas.at(-1).saldoCapital.toFixed(2), '0.00');
});

test('el saldo decrece de forma monótona hasta cero', () => {
  const { cuotas } = generarCronograma({ ...BASE, numeroCuotas: 12 });

  for (let i = 1; i < cuotas.length; i += 1) {
    assert.ok(cuotas[i].saldoCapital.lt(cuotas[i - 1].saldoCapital));
  }
  assert.equal(cuotas.at(-1).saldoCapital.toFixed(2), '0.00');
});

test('el interés de cada cuota se calcula sobre el saldo, no sobre el capital inicial', () => {
  const { cuotas } = generarCronograma(BASE);

  // interés de la cuota 2 = 5% del saldo tras la cuota 1 (767.99)
  assert.equal(cuotas[0].saldoCapital.toFixed(2), '767.99');
  assert.equal(cuotas[1].interes.toFixed(2), '38.40');
});

test('cada cuota cuadra: capital + interés = total', () => {
  const { cuotas } = generarCronograma({ ...BASE, capital: 7777.77, numeroCuotas: 9 });

  for (const cuota of cuotas) {
    assert.equal(cuota.capital.plus(cuota.interes).toFixed(2), cuota.total.toFixed(2));
  }
});

test('capital indivisible sigue cuadrando al céntimo', () => {
  for (const numeroCuotas of [3, 7, 11, 13]) {
    const { cuotas, resumen } = generarCronograma({ ...BASE, capital: 1000, numeroCuotas });

    assert.equal(resumen.totalCapital.toFixed(2), '1000.00', `falló con ${numeroCuotas} cuotas`);
    assert.equal(cuotas.at(-1).saldoCapital.toFixed(2), '0.00', `falló con ${numeroCuotas} cuotas`);
  }
});

test('préstamo sin interés reparte solo capital en cuotas iguales', () => {
  const { cuotas, resumen } = generarCronograma({ ...BASE, tasaInteres: 0 });

  assert.equal(resumen.totalInteres.toFixed(2), '0.00');
  assert.equal(resumen.totalCapital.toFixed(2), '1000.00');
  assert.deepEqual(cuotas.map((c) => c.total.toFixed(2)), ['250.00', '250.00', '250.00', '250.00']);
});

// -------------------------------------------- comparación entre modalidades

test('cobra menos interés que interés fijo y más que interés sobre saldo', () => {
  const interesDe = (modalidad) => generarCronograma({ ...BASE, modalidad }).resumen.totalInteres;

  const fijo = interesDe('INTERES_FIJO');
  const francesa = interesDe('CUOTAS_FIJAS');
  const sobreSaldo = interesDe('INTERES_SOBRE_SALDO');

  assert.equal(fijo.toFixed(2), '200.00');
  assert.equal(francesa.toFixed(2), '128.05');
  assert.equal(sobreSaldo.toFixed(2), '125.00');

  assert.ok(francesa.lt(fijo), 'la francesa debe cobrar menos que el interés fijo');
  assert.ok(francesa.gt(sobreSaldo), 'pero más que sobre saldo, porque amortiza más lento al inicio');
});

test('a mayor plazo, mayor interés total y menor cuota', () => {
  const corto = generarCronograma({ ...BASE, numeroCuotas: 4 });
  const largo = generarCronograma({ ...BASE, numeroCuotas: 12 });

  assert.ok(largo.resumen.totalInteres.gt(corto.resumen.totalInteres));
  assert.ok(largo.cuotas[0].total.lt(corto.cuotas[0].total));
});

test('respeta la conversión de tasa por frecuencia de pago', () => {
  // 36% anual con pago mensual = 3% por cuota
  const anual = generarCronograma({ ...BASE, tasaInteres: 36, tipoInteres: 'ANUAL' });
  const mensual = generarCronograma({ ...BASE, tasaInteres: 3, tipoInteres: 'MENSUAL' });

  assert.deepEqual(
    anual.cuotas.map((c) => c.total.toFixed(2)),
    mensual.cuotas.map((c) => c.total.toFixed(2))
  );
});

// ------------------------------------------ recálculo tras un pago (RF-11)

test('tras un abono extra se rehace la anualidad sobre el saldo restante', () => {
  const tasa = tasaPorCuota({ tasaInteres: 5, tipoInteres: 'MENSUAL', frecuenciaPago: 'MENSUAL' });

  const cuotas = recalcularCuotasPendientes({
    saldoInicial: 600,
    capitalARepartir: 600,
    capitalOriginal: 1000,
    tasaPorCuota: tasa,
    modalidad: 'CUOTAS_FIJAS',
    numeroCuotasPendientes: 3,
  });

  // 600 al 5% en 3 cuotas: 600 × 0.05 / (1 − 1.05⁻³) = 220.33
  assert.equal(cuotas[0].total.toFixed(2), '220.33');
  assert.equal(cuotas[1].total.toFixed(2), '220.33');
  assert.equal(sumar(cuotas, 'capital').toFixed(2), '600.00');
  assert.equal(cuotas.at(-1).saldoCapital.toFixed(2), '0.00');
});

test('el recálculo mantiene la cuota constante entre las que quedan', () => {
  const tasa = tasaPorCuota({ tasaInteres: 2, tipoInteres: 'MENSUAL', frecuenciaPago: 'MENSUAL' });

  const cuotas = recalcularCuotasPendientes({
    saldoInicial: 5000,
    capitalARepartir: 5000,
    capitalOriginal: 8000,
    tasaPorCuota: tasa,
    modalidad: 'CUOTAS_FIJAS',
    numeroCuotasPendientes: 6,
  });

  const totales = cuotas.slice(0, -1).map((c) => c.total.toFixed(2));
  assert.equal(new Set(totales).size, 1, 'todas menos la última deben ser idénticas');
  assert.equal(sumar(cuotas, 'capital').toFixed(2), '5000.00');
});

test('sin cuotas pendientes devuelve lista vacía', () => {
  const cuotas = recalcularCuotasPendientes({
    saldoInicial: 0,
    capitalARepartir: 0,
    capitalOriginal: 1000,
    tasaPorCuota: new Decimal('0.05'),
    modalidad: 'CUOTAS_FIJAS',
    numeroCuotasPendientes: 0,
  });

  assert.deepEqual(cuotas, []);
});

test('una tasa muy alta no genera capital negativo ni un préstamo impagable', () => {
  const { cuotas, resumen } = generarCronograma({
    ...BASE,
    tasaInteres: 50,
    tipoInteres: 'MENSUAL',
    numeroCuotas: 24,
  });

  for (const cuota of cuotas) {
    assert.ok(cuota.capital.gte(0), 'ninguna cuota puede devolver capital al cliente');
  }
  assert.equal(resumen.totalCapital.toFixed(2), '1000.00');
  assert.equal(cuotas.at(-1).saldoCapital.toFixed(2), '0.00');
});
