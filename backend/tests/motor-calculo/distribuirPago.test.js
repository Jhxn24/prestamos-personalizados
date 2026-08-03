const test = require('node:test');
const assert = require('node:assert/strict');
const { distribuirPago, estadoDeCuota, ErrorMotorCalculo } = require('../../src/modules/motor-calculo');

/**
 * La cascada interés -> capital decide cuánta deuda real se extingue con cada
 * pago. Si se invirtiera, el cliente amortizaría capital sin pagar el interés
 * devengado y el negocio perdería dinero silenciosamente.
 */

test('un pago exacto salda interés y capital de la cuota sin excedente', () => {
  const r = distribuirPago({ monto: 300, interesPendiente: 50, capitalPendiente: 250 });

  assert.equal(r.interesAplicado.toString(), '50');
  assert.equal(r.capitalAplicado.toString(), '250');
  assert.equal(r.excedente.toString(), '0');
});

test('el interés se cobra ANTES que el capital', () => {
  const r = distribuirPago({ monto: 60, interesPendiente: 50, capitalPendiente: 250 });

  assert.equal(r.interesAplicado.toString(), '50');
  assert.equal(r.capitalAplicado.toString(), '10');
});

test('pago que cubre solo intereses deja el capital intacto (RF-12)', () => {
  const r = distribuirPago({ monto: 50, interesPendiente: 50, capitalPendiente: 250 });

  assert.equal(r.interesAplicado.toString(), '50');
  assert.equal(r.capitalAplicado.toString(), '0');
  assert.equal(r.excedente.toString(), '0');
});

test('pago menor al interés no amortiza nada de capital', () => {
  const r = distribuirPago({ monto: 20, interesPendiente: 50, capitalPendiente: 250 });

  assert.equal(r.interesAplicado.toString(), '20');
  assert.equal(r.capitalAplicado.toString(), '0');
});

test('pago parcial reparte correctamente entre interés y capital (RF-15)', () => {
  const r = distribuirPago({ monto: 150, interesPendiente: 50, capitalPendiente: 250 });

  assert.equal(r.interesAplicado.toString(), '50');
  assert.equal(r.capitalAplicado.toString(), '100');
  assert.equal(r.excedente.toString(), '0');
});

test('lo que supera la cuota queda como excedente, no se pierde', () => {
  const r = distribuirPago({ monto: 500, interesPendiente: 50, capitalPendiente: 250 });

  assert.equal(r.interesAplicado.toString(), '50');
  assert.equal(r.capitalAplicado.toString(), '250');
  assert.equal(r.excedente.toString(), '200');
});

test('el pago siempre cuadra: interés + capital + excedente = monto', () => {
  const casos = [
    { monto: 300, interesPendiente: 50, capitalPendiente: 250 },
    { monto: 33.33, interesPendiente: 12.5, capitalPendiente: 250 },
    { monto: 1000, interesPendiente: 50, capitalPendiente: 250 },
    { monto: 0.01, interesPendiente: 50, capitalPendiente: 250 },
  ];

  for (const caso of casos) {
    const r = distribuirPago(caso);
    const suma = r.interesAplicado.plus(r.capitalAplicado).plus(r.excedente);
    assert.equal(suma.toFixed(2), Number(caso.monto).toFixed(2), `falló con monto ${caso.monto}`);
  }
});

test('cuota sin interés pendiente aplica todo a capital', () => {
  const r = distribuirPago({ monto: 100, interesPendiente: 0, capitalPendiente: 250 });

  assert.equal(r.interesAplicado.toString(), '0');
  assert.equal(r.capitalAplicado.toString(), '100');
});

test('rechaza montos no positivos en vez de corromper el saldo', () => {
  assert.throws(() => distribuirPago({ monto: 0, interesPendiente: 50, capitalPendiente: 250 }), ErrorMotorCalculo);
  assert.throws(() => distribuirPago({ monto: -10, interesPendiente: 50, capitalPendiente: 250 }), /mayor a 0/);
});

test('estadoDeCuota distingue pendiente, parcial y pagada', () => {
  assert.equal(estadoDeCuota({ montoPagado: 0, total: 300 }), 'PENDIENTE');
  assert.equal(estadoDeCuota({ montoPagado: 150, total: 300 }), 'PARCIAL');
  assert.equal(estadoDeCuota({ montoPagado: 300, total: 300 }), 'PAGADA');
});

test('una cuota pagada de más sigue contando como PAGADA', () => {
  assert.equal(estadoDeCuota({ montoPagado: 350, total: 300 }), 'PAGADA');
});

test('un céntimo de menos deja la cuota PARCIAL, no PAGADA', () => {
  assert.equal(estadoDeCuota({ montoPagado: '299.99', total: 300 }), 'PARCIAL');
});
