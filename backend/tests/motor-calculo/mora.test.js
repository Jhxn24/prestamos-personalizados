const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularDiasAtraso, calcularMora, evaluarAtraso, diasEntre } = require('../../src/modules/motor-calculo');

const fecha = (iso) => new Date(`${iso}T00:00:00.000Z`);

test('el atraso se mide en días de calendario, no en horas', () => {
  // Pagar a las 23:00 del día de vencimiento NO es atraso
  const dias = calcularDiasAtraso({
    fechaVencimiento: fecha('2026-03-10'),
    fechaReferencia: new Date('2026-03-10T23:59:00.000Z'),
  });
  assert.equal(dias, 0);
});

test('pagar antes del vencimiento nunca da atraso negativo', () => {
  const dias = calcularDiasAtraso({
    fechaVencimiento: fecha('2026-03-10'),
    fechaReferencia: fecha('2026-03-01'),
  });
  assert.equal(dias, 0);
});

test('cuenta los días de atraso desde el vencimiento', () => {
  const dias = calcularDiasAtraso({
    fechaVencimiento: fecha('2026-03-10'),
    fechaReferencia: fecha('2026-03-15'),
  });
  assert.equal(dias, 5);
});

test('los días de gracia se descuentan del atraso', () => {
  const parametros = { fechaVencimiento: fecha('2026-03-10'), fechaReferencia: fecha('2026-03-15') };

  assert.equal(calcularDiasAtraso({ ...parametros, diasGracia: 3 }), 2);
  // dentro de la gracia todavía no hay atraso
  assert.equal(calcularDiasAtraso({ ...parametros, diasGracia: 5 }), 0);
  assert.equal(calcularDiasAtraso({ ...parametros, diasGracia: 10 }), 0);
});

test('el atraso cruza meses y años correctamente', () => {
  assert.equal(diasEntre(fecha('2026-12-28'), fecha('2027-01-04')), 7);
  assert.equal(diasEntre(fecha('2028-02-27'), fecha('2028-03-01')), 3); // 2028 bisiesto
});

test('la mora se calcula solo sobre el capital pendiente de la cuota', () => {
  // Cuota de 250 capital + 50 interés. Al 1% diario por 5 días:
  // 250 * 1% * 5 = 12.50 (el interés de 50 NO genera mora)
  const mora = calcularMora({ capitalPendienteCuota: 250, tasaMoraDiaria: 1, diasAtraso: 5 });
  assert.equal(mora.toString(), '12.5');
});

test('la mora crece linealmente con los días de atraso', () => {
  const base = { capitalPendienteCuota: 1000, tasaMoraDiaria: 0.5 };

  assert.equal(calcularMora({ ...base, diasAtraso: 1 }).toString(), '5');
  assert.equal(calcularMora({ ...base, diasAtraso: 10 }).toString(), '50');
  assert.equal(calcularMora({ ...base, diasAtraso: 30 }).toString(), '150');
});

test('la mora es idempotente: recalcularla no la acumula', () => {
  const parametros = { capitalPendienteCuota: 250, tasaMoraDiaria: 1, diasAtraso: 5 };

  const primera = calcularMora(parametros);
  const segunda = calcularMora(parametros);

  assert.equal(primera.toString(), segunda.toString());
});

test('sin atraso, sin capital pendiente o sin tasa no hay mora', () => {
  assert.equal(calcularMora({ capitalPendienteCuota: 250, tasaMoraDiaria: 1, diasAtraso: 0 }).toString(), '0');
  assert.equal(calcularMora({ capitalPendienteCuota: 0, tasaMoraDiaria: 1, diasAtraso: 5 }).toString(), '0');
  assert.equal(calcularMora({ capitalPendienteCuota: 250, tasaMoraDiaria: 0, diasAtraso: 5 }).toString(), '0');
});

test('la mora se redondea a 2 decimales', () => {
  // 333.33 * 0.33% * 7 = 7.6999...
  const mora = calcularMora({ capitalPendienteCuota: 333.33, tasaMoraDiaria: 0.33, diasAtraso: 7 });
  assert.equal(mora.toFixed(2), '7.70');
});

test('una cuota al día no se marca vencida bajo ninguna política', () => {
  for (const politicaMora of ['NINGUNA', 'EXTENSION_DIA', 'COBRO_DOBLE', 'MORA']) {
    const r = evaluarAtraso({
      politicaMora,
      fechaVencimiento: fecha('2026-03-10'),
      fechaReferencia: fecha('2026-03-10'),
      tasaMoraDiaria: 1,
      capitalPendienteCuota: 250,
    });

    assert.equal(r.vencida, false, `falló con ${politicaMora}`);
    assert.equal(r.mora.toString(), '0');
  }
});

test('política MORA: marca vencida y cobra sobre el capital', () => {
  const r = evaluarAtraso({
    politicaMora: 'MORA',
    fechaVencimiento: fecha('2026-03-10'),
    fechaReferencia: fecha('2026-03-15'),
    tasaMoraDiaria: 1,
    capitalPendienteCuota: 250,
  });

  assert.equal(r.vencida, true);
  assert.equal(r.diasAtraso, 5);
  assert.equal(r.mora.toString(), '12.5');
  assert.equal(r.nuevaFechaVencimiento, null);
});

test('política COBRO_DOBLE: marca vencida SIN recargo (la deuda solo se acumula)', () => {
  const r = evaluarAtraso({
    politicaMora: 'COBRO_DOBLE',
    fechaVencimiento: fecha('2026-03-10'),
    fechaReferencia: fecha('2026-03-15'),
    tasaMoraDiaria: 1,
    capitalPendienteCuota: 250,
  });

  assert.equal(r.vencida, true);
  assert.equal(r.diasAtraso, 5);
  assert.equal(r.mora.toString(), '0', 'cobro doble no debe añadir dinero a la deuda');
});

test('política NINGUNA: marca vencida sin cobrar nada', () => {
  const r = evaluarAtraso({
    politicaMora: 'NINGUNA',
    fechaVencimiento: fecha('2026-03-10'),
    fechaReferencia: fecha('2026-03-15'),
    tasaMoraDiaria: 1,
    capitalPendienteCuota: 250,
  });

  assert.equal(r.vencida, true);
  assert.equal(r.mora.toString(), '0');
});

test('política EXTENSION_DIA: corre el vencimiento un día y perdona el atraso', () => {
  const r = evaluarAtraso({
    politicaMora: 'EXTENSION_DIA',
    fechaVencimiento: fecha('2026-03-10'),
    fechaReferencia: fecha('2026-03-11'),
    capitalPendienteCuota: 250,
  });

  assert.equal(r.nuevaFechaVencimiento.toISOString().slice(0, 10), '2026-03-11');
  assert.equal(r.diasAtraso, 0);
  assert.equal(r.vencida, false);
  assert.equal(r.mora.toString(), '0');
});

test('EXTENSION_DIA solo se aplica una vez: la deuda no puede vencer eternamente', () => {
  const r = evaluarAtraso({
    politicaMora: 'EXTENSION_DIA',
    fechaVencimiento: fecha('2026-03-11'), // ya extendida
    fechaReferencia: fecha('2026-03-20'),
    capitalPendienteCuota: 250,
    extensionAplicada: true,
  });

  assert.equal(r.nuevaFechaVencimiento, null, 'no debe volver a extender');
  assert.equal(r.diasAtraso, 9);
  assert.equal(r.vencida, true);
});

test('EXTENSION_DIA con atraso largo: extiende un día pero la cuota sigue vencida', () => {
  const r = evaluarAtraso({
    politicaMora: 'EXTENSION_DIA',
    fechaVencimiento: fecha('2026-03-10'),
    fechaReferencia: fecha('2026-03-20'),
    capitalPendienteCuota: 250,
  });

  assert.equal(r.nuevaFechaVencimiento.toISOString().slice(0, 10), '2026-03-11');
  assert.equal(r.diasAtraso, 9);
  assert.equal(r.vencida, true);
});
