const test = require('node:test');
const assert = require('node:assert/strict');
const { generarCronograma, ErrorMotorCalculo } = require('../../src/modules/motor-calculo');

const BASE = {
  capital: 1000,
  tasaInteres: 5,
  tipoInteres: 'MENSUAL',
  frecuenciaPago: 'MENSUAL',
  numeroCuotas: 4,
  modalidad: 'INTERES_FIJO',
  fechaDesembolso: new Date(Date.UTC(2026, 0, 15)),
};

test('rechaza capital cero o negativo', () => {
  assert.throws(() => generarCronograma({ ...BASE, capital: 0 }), ErrorMotorCalculo);
  assert.throws(() => generarCronograma({ ...BASE, capital: -500 }), /capital/);
});

test('rechaza tasa negativa', () => {
  assert.throws(() => generarCronograma({ ...BASE, tasaInteres: -1 }), /tasa/i);
});

test('rechaza número de cuotas inválido', () => {
  assert.throws(() => generarCronograma({ ...BASE, numeroCuotas: 0 }), /numeroCuotas/);
  assert.throws(() => generarCronograma({ ...BASE, numeroCuotas: 2.5 }), /numeroCuotas/);
});

test('rechaza tipo de interés y frecuencia desconocidos', () => {
  assert.throws(() => generarCronograma({ ...BASE, tipoInteres: 'SEMANAL' }), /tipoInteres/);
  assert.throws(() => generarCronograma({ ...BASE, frecuenciaPago: 'ANUAL' }), /frecuenciaPago/);
});

test('acepta las cuatro modalidades del negocio', () => {
  for (const modalidad of ['INTERES_FIJO', 'INTERES_SOBRE_SALDO', 'CUOTAS_FIJAS', 'CAPITAL_AL_FINAL']) {
    const { cuotas } = generarCronograma({ ...BASE, modalidad });
    assert.equal(cuotas.length, BASE.numeroCuotas, `falló con ${modalidad}`);
  }
});

test('rechaza una modalidad inexistente', () => {
  assert.throws(() => generarCronograma({ ...BASE, modalidad: 'ALEMANA' }), /modalidad/);
});

test('rechaza fecha de desembolso inválida', () => {
  assert.throws(() => generarCronograma({ ...BASE, fechaDesembolso: '2026-01-15' }), /fechaDesembolso/);
  assert.throws(() => generarCronograma({ ...BASE, fechaDesembolso: new Date('nope') }), /fechaDesembolso/);
});

test('PERSONALIZADA exige días válidos', () => {
  assert.throws(
    () => generarCronograma({ ...BASE, frecuenciaPago: 'PERSONALIZADA' }),
    /diasPersonalizados/
  );
  assert.throws(
    () => generarCronograma({ ...BASE, frecuenciaPago: 'PERSONALIZADA', diasPersonalizados: 0 }),
    /diasPersonalizados/
  );
});

test('los errores del motor son distinguibles de errores del sistema', () => {
  try {
    generarCronograma({ ...BASE, capital: -1 });
    assert.fail('debió lanzar');
  } catch (error) {
    assert.ok(error instanceof ErrorMotorCalculo);
    assert.equal(error.name, 'ErrorMotorCalculo');
  }
});
