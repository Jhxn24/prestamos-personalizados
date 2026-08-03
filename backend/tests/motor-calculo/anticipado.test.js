const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calcularInteresAnticipado,
  distribuirPago,
  ErrorMotorCalculo,
} = require('../../src/modules/motor-calculo');

const fecha = (iso) => new Date(`${iso}T00:00:00.000Z`);

// Periodo mensual típico: del 15 de febrero al 15 de marzo (28 días).
const PERIODO = {
  interesCuota: 50,
  inicioPeriodo: fecha('2026-02-15'),
  fechaVencimiento: fecha('2026-03-15'),
};

test('política COMPLETO cobra el interés íntegro aunque se pague antes', () => {
  const r = calcularInteresAnticipado({ ...PERIODO, fechaPago: fecha('2026-02-20'), politica: 'COMPLETO' });

  assert.equal(r.interes.toString(), '50');
  assert.equal(r.condonado.toString(), '0');
  assert.equal(r.anticipado, false);
});

test('política PROPORCIONAL cobra solo el interés devengado hasta el pago', () => {
  // 14 de 28 días transcurridos -> la mitad del interés
  const r = calcularInteresAnticipado({
    ...PERIODO,
    fechaPago: fecha('2026-03-01'),
    politica: 'PROPORCIONAL',
  });

  assert.equal(r.diasPeriodo, 28);
  assert.equal(r.diasDevengados, 14);
  assert.equal(r.interes.toString(), '25');
  assert.equal(r.condonado.toString(), '25');
  assert.equal(r.anticipado, true);
});

test('el interés cobrado más el condonado siempre suman el interés del periodo', () => {
  for (const dia of ['2026-02-16', '2026-02-20', '2026-03-01', '2026-03-10', '2026-03-14']) {
    const r = calcularInteresAnticipado({ ...PERIODO, fechaPago: fecha(dia), politica: 'PROPORCIONAL' });
    assert.equal(r.interes.plus(r.condonado).toFixed(2), '50.00', `falló el día ${dia}`);
  }
});

test('pagar el mismo día del vencimiento no da descuento', () => {
  const r = calcularInteresAnticipado({
    ...PERIODO,
    fechaPago: fecha('2026-03-15'),
    politica: 'PROPORCIONAL',
  });

  assert.equal(r.interes.toString(), '50');
  assert.equal(r.anticipado, false);
});

test('pagar tarde tampoco da descuento (no hay anticipo que premiar)', () => {
  const r = calcularInteresAnticipado({
    ...PERIODO,
    fechaPago: fecha('2026-03-20'),
    politica: 'PROPORCIONAL',
  });

  assert.equal(r.interes.toString(), '50');
  assert.equal(r.condonado.toString(), '0');
});

test('pagar el primer día del periodo devenga interés cero', () => {
  const r = calcularInteresAnticipado({
    ...PERIODO,
    fechaPago: fecha('2026-02-15'),
    politica: 'PROPORCIONAL',
  });

  assert.equal(r.interes.toString(), '0');
  assert.equal(r.condonado.toString(), '50');
});

test('un pago anterior al inicio del periodo no genera interés negativo', () => {
  const r = calcularInteresAnticipado({
    ...PERIODO,
    fechaPago: fecha('2026-01-01'),
    politica: 'PROPORCIONAL',
  });

  assert.equal(r.interes.toString(), '0');
  assert.ok(r.interes.gte(0));
});

test('el prorrateo redondea a 2 decimales', () => {
  // 50 * 5/28 = 8.928...
  const r = calcularInteresAnticipado({
    ...PERIODO,
    fechaPago: fecha('2026-02-20'),
    politica: 'PROPORCIONAL',
  });

  assert.equal(r.interes.toFixed(2), '8.93');
  assert.equal(r.condonado.toFixed(2), '41.07');
});

test('funciona en periodos diarios sin dividir entre cero', () => {
  const r = calcularInteresAnticipado({
    interesCuota: 5,
    inicioPeriodo: fecha('2026-03-10'),
    fechaVencimiento: fecha('2026-03-10'),
    fechaPago: fecha('2026-03-10'),
    politica: 'PROPORCIONAL',
  });

  assert.equal(r.interes.toString(), '5');
});

test('rechaza una política desconocida en vez de asumir una', () => {
  assert.throws(
    () => calcularInteresAnticipado({ ...PERIODO, fechaPago: fecha('2026-03-01'), politica: 'MEDIO' }),
    ErrorMotorCalculo
  );
});

test('la cascada de pago cobra la mora antes que el interés y el capital', () => {
  const r = distribuirPago({ monto: 300, moraPendiente: 12.5, interesPendiente: 50, capitalPendiente: 250 });

  assert.equal(r.moraAplicada.toString(), '12.5');
  assert.equal(r.interesAplicado.toString(), '50');
  assert.equal(r.capitalAplicado.toString(), '237.5');
  assert.equal(r.excedente.toString(), '0');
});

test('un pago que solo alcanza para la mora no toca interés ni capital', () => {
  const r = distribuirPago({ monto: 10, moraPendiente: 12.5, interesPendiente: 50, capitalPendiente: 250 });

  assert.equal(r.moraAplicada.toString(), '10');
  assert.equal(r.interesAplicado.toString(), '0');
  assert.equal(r.capitalAplicado.toString(), '0');
});

test('con mora, el pago sigue cuadrando exactamente', () => {
  const casos = [
    { monto: 300, moraPendiente: 12.5, interesPendiente: 50, capitalPendiente: 250 },
    { monto: 1000, moraPendiente: 12.5, interesPendiente: 50, capitalPendiente: 250 },
    { monto: 5, moraPendiente: 12.5, interesPendiente: 50, capitalPendiente: 250 },
  ];

  for (const caso of casos) {
    const r = distribuirPago(caso);
    const suma = r.moraAplicada.plus(r.interesAplicado).plus(r.capitalAplicado).plus(r.excedente);
    assert.equal(suma.toFixed(2), caso.monto.toFixed(2));
  }
});

test('sin mora la cascada se comporta como antes', () => {
  const r = distribuirPago({ monto: 300, interesPendiente: 50, capitalPendiente: 250 });

  assert.equal(r.moraAplicada.toString(), '0');
  assert.equal(r.interesAplicado.toString(), '50');
  assert.equal(r.capitalAplicado.toString(), '250');
});
