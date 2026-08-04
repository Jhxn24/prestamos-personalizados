const Decimal = require('decimal.js');

/** Montos de dinero: siempre 2 decimales, como string (nunca number, para no perder precisión). */
function formatearMonto(valor) {
  if (valor === null || valor === undefined) return null;
  return new Decimal(valor.toString()).toFixed(2);
}

/** Tasas (%): a diferencia del dinero, no se recortan a 2 decimales (RF-05 admite tasas diarias con más precisión). */
function formatearTasa(valor) {
  if (valor === null || valor === undefined) return null;
  return new Decimal(valor.toString()).toString();
}

module.exports = { formatearMonto, formatearTasa };
