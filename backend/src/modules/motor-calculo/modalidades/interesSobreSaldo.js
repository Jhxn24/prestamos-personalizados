const Decimal = require('decimal.js');
const { dinero, repartirCapital } = require('../redondeo');

/**
 * INTERÉS SOBRE SALDO (requerimientos.md §8)
 *
 * El interés se recalcula sobre el capital que sigue pendiente, por lo que cada
 * abono a capital reduce el interés del periodo siguiente (RF-13). El capital se
 * amortiza de forma constante y el interés va decreciendo.
 *
 *   interesCuota_i = saldoAntesDeLaCuota_i * tasaPorCuota
 */
function generarCuotas({ capital, tasaPorCuota, numeroCuotas }) {
  const capitalInicial = new Decimal(capital);
  const partesCapital = repartirCapital(capitalInicial, numeroCuotas);

  let saldo = capitalInicial;

  return partesCapital.map((capitalCuota) => {
    const interesCuota = dinero(saldo.times(tasaPorCuota));
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
