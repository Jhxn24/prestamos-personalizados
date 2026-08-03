const Decimal = require('decimal.js');
const { dinero, repartirCapital } = require('../redondeo');

/**
 * INTERÉS FIJO (requerimientos.md §8)
 *
 * El interés se calcula SIEMPRE sobre el capital inicial, sin importar los
 * abonos ya realizados. Por eso el interés de cada cuota es idéntico y no
 * depende del saldo.
 *
 *   interesCuota = capitalInicial * tasaPorCuota   (constante)
 *   capitalCuota = capitalInicial / numeroCuotas   (residuo a la última)
 */
function generarCuotas({ capital, tasaPorCuota, numeroCuotas }) {
  const capitalInicial = new Decimal(capital);
  const interesCuota = dinero(capitalInicial.times(tasaPorCuota));
  const partesCapital = repartirCapital(capitalInicial, numeroCuotas);

  let saldo = capitalInicial;

  return partesCapital.map((capitalCuota) => {
    saldo = saldo.minus(capitalCuota);

    return {
      capital: capitalCuota,
      interes: interesCuota,
      total: capitalCuota.plus(interesCuota),
      saldoCapital: saldo,
    };
  });
}

module.exports = { generarCuotas };
