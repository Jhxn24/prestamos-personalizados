const Decimal = require('decimal.js');
const { dinero } = require('../redondeo');

/**
 * CAPITAL AL FINAL (requerimientos.md §8)
 *
 * Todas las cuotas son solo interés, calculado sobre el capital inicial, salvo
 * la última, que además liquida el 100% del capital. Es el esquema típico de
 * un préstamo "bala": el capital no se amortiza hasta el vencimiento final.
 *
 *   interesCuota = capitalInicial * tasaPorCuota   (constante, todas las cuotas)
 *   capitalCuota = 0                               (excepto la última)
 *   capitalÚltimaCuota = capitalInicial
 */
function generarCuotas({ capital, tasaPorCuota, numeroCuotas }) {
  const capitalInicial = new Decimal(capital);
  const interesCuota = dinero(capitalInicial.times(tasaPorCuota));
  const cero = new Decimal(0);

  return Array.from({ length: numeroCuotas }, (_, indice) => {
    const esUltima = indice === numeroCuotas - 1;
    const capitalCuota = esUltima ? capitalInicial : cero;

    return {
      capital: capitalCuota,
      interes: interesCuota,
      total: capitalCuota.plus(interesCuota),
      saldoCapital: esUltima ? cero : capitalInicial,
    };
  });
}

module.exports = { generarCuotas };
