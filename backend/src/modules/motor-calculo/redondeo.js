const Decimal = require('decimal.js');

const DECIMALES_DINERO = 2;

/**
 * Redondeo de dinero a 2 decimales (medio hacia arriba, como en caja).
 */
function dinero(valor) {
  return new Decimal(valor).toDecimalPlaces(DECIMALES_DINERO, Decimal.ROUND_HALF_UP);
}

/**
 * Reparte un capital en N cuotas garantizando que la SUMA sea exactamente
 * el capital original (invariante crítico: el negocio no puede prestar 1000
 * y que el cronograma amortice 999.99).
 *
 * Cada cuota lleva el monto truncado hacia abajo y el residuo se acumula en
 * la última, que es donde el cliente naturalmente espera el ajuste.
 */
function repartirCapital(capital, numeroCuotas) {
  const total = new Decimal(capital);
  const base = total.div(numeroCuotas).toDecimalPlaces(DECIMALES_DINERO, Decimal.ROUND_DOWN);

  const partes = Array.from({ length: numeroCuotas }, () => base);
  const residuo = total.minus(base.times(numeroCuotas));

  partes[numeroCuotas - 1] = base.plus(residuo);

  return partes;
}

module.exports = { dinero, repartirCapital, DECIMALES_DINERO };
