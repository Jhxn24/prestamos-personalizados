const test = require('node:test');
const assert = require('node:assert/strict');
const { generarCronograma } = require('../../src/modules/motor-calculo');

const BASE = {
  capital: 1000,
  tasaInteres: 5,
  tipoInteres: 'MENSUAL',
  numeroCuotas: 4,
  modalidad: 'INTERES_FIJO',
  fechaDesembolso: new Date(Date.UTC(2026, 0, 15)),
};

const iso = (fecha) => fecha.toISOString().slice(0, 10);

test('frecuencia diaria avanza un día por cuota', () => {
  const { cuotas } = generarCronograma({ ...BASE, frecuenciaPago: 'DIARIA' });
  assert.deepEqual(cuotas.map((c) => iso(c.fechaVencimiento)), [
    '2026-01-16',
    '2026-01-17',
    '2026-01-18',
    '2026-01-19',
  ]);
});

test('frecuencia semanal avanza 7 días por cuota', () => {
  const { cuotas } = generarCronograma({ ...BASE, frecuenciaPago: 'SEMANAL' });
  assert.deepEqual(cuotas.map((c) => iso(c.fechaVencimiento)), [
    '2026-01-22',
    '2026-01-29',
    '2026-02-05',
    '2026-02-12',
  ]);
});

test('frecuencia quincenal avanza 15 días por cuota', () => {
  const { cuotas } = generarCronograma({ ...BASE, frecuenciaPago: 'QUINCENAL' });
  assert.equal(iso(cuotas[0].fechaVencimiento), '2026-01-30');
  assert.equal(iso(cuotas[1].fechaVencimiento), '2026-02-14');
});

test('frecuencia mensual avanza por calendario, no por 30 días fijos', () => {
  const { cuotas } = generarCronograma({ ...BASE, frecuenciaPago: 'MENSUAL' });
  assert.deepEqual(cuotas.map((c) => iso(c.fechaVencimiento)), [
    '2026-02-15',
    '2026-03-15',
    '2026-04-15',
    '2026-05-15',
  ]);
});

test('desembolso a fin de mes se recorta al último día de los meses cortos', () => {
  const { cuotas } = generarCronograma({
    ...BASE,
    frecuenciaPago: 'MENSUAL',
    fechaDesembolso: new Date(Date.UTC(2026, 0, 31)),
  });

  // 31 ene + 1 mes NO debe desbordar a 3 de marzo
  assert.deepEqual(cuotas.map((c) => iso(c.fechaVencimiento)), [
    '2026-02-28',
    '2026-03-31',
    '2026-04-30',
    '2026-05-31',
  ]);
});

test('año bisiesto ajusta correctamente el 29 de febrero', () => {
  const { cuotas } = generarCronograma({
    ...BASE,
    frecuenciaPago: 'MENSUAL',
    numeroCuotas: 1,
    fechaDesembolso: new Date(Date.UTC(2028, 0, 31)),
  });

  assert.equal(iso(cuotas[0].fechaVencimiento), '2028-02-29');
});

test('frecuencia bimestral y trimestral avanzan por meses de calendario', () => {
  const bimestral = generarCronograma({ ...BASE, frecuenciaPago: 'BIMESTRAL', numeroCuotas: 2 });
  assert.deepEqual(bimestral.cuotas.map((c) => iso(c.fechaVencimiento)), ['2026-03-15', '2026-05-15']);

  const trimestral = generarCronograma({ ...BASE, frecuenciaPago: 'TRIMESTRAL', numeroCuotas: 2 });
  assert.deepEqual(trimestral.cuotas.map((c) => iso(c.fechaVencimiento)), ['2026-04-15', '2026-07-15']);
});

test('frecuencia personalizada avanza los días indicados', () => {
  const { cuotas } = generarCronograma({
    ...BASE,
    frecuenciaPago: 'PERSONALIZADA',
    diasPersonalizados: 10,
    numeroCuotas: 3,
  });

  assert.deepEqual(cuotas.map((c) => iso(c.fechaVencimiento)), [
    '2026-01-25',
    '2026-02-04',
    '2026-02-14',
  ]);
});

test('las fechas cruzan el fin de año sin romperse', () => {
  const { cuotas } = generarCronograma({
    ...BASE,
    frecuenciaPago: 'MENSUAL',
    numeroCuotas: 3,
    fechaDesembolso: new Date(Date.UTC(2026, 10, 30)),
  });

  assert.deepEqual(cuotas.map((c) => iso(c.fechaVencimiento)), [
    '2026-12-30',
    '2027-01-30',
    '2027-02-28',
  ]);
});

test('las cuotas se numeran desde 1 y en orden ascendente', () => {
  const { cuotas } = generarCronograma({ ...BASE, frecuenciaPago: 'MENSUAL' });

  assert.deepEqual(cuotas.map((c) => c.numero), [1, 2, 3, 4]);
  for (let i = 1; i < cuotas.length; i += 1) {
    assert.ok(cuotas[i].fechaVencimiento > cuotas[i - 1].fechaVencimiento);
  }
});
