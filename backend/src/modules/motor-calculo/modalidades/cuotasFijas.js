const Decimal = require('decimal.js');
const { dinero } = require('../redondeo');

/**
 * CUOTAS FIJAS — amortización francesa (requerimientos.md §8)
 *
 * Todas las cuotas valen lo mismo. Lo que cambia es su composición interna: al
 * principio casi todo es interés y muy poco capital, y esa proporción se va
 * invirtiendo. El interés se calcula sobre el saldo pendiente, igual que en la
 * modalidad sobre saldo, pero aquí el capital se ajusta para que el total salga
 * siempre igual.
 *
 * La cuota sale de la fórmula de anualidad:
 *
 *              i
 *   C = P · ─────────────
 *           1 − (1 + i)⁻ⁿ
 *
 * donde P es el capital, i la tasa por periodo y n el número de cuotas.
 */
function calcularCuotaFija({ capital, tasaPorCuota, numeroCuotas }) {
  const principal = new Decimal(capital);
  const tasa = new Decimal(tasaPorCuota);

  // Sin interés la fórmula se indetermina (0/0): el reparto es lineal.
  if (tasa.isZero()) {
    return dinero(principal.div(numeroCuotas));
  }

  const factorDescuento = new Decimal(1).plus(tasa).pow(-numeroCuotas);

  return dinero(principal.times(tasa).div(new Decimal(1).minus(factorDescuento)));
}

/**
 * Construye la tabla de amortización.
 *
 * La cuota se redondea a céntimos, así que la suma de los capitales redondeados
 * casi nunca da el capital exacto. La última cuota amortiza el saldo que quede,
 * lo que hace que su total difiera unos céntimos de las demás. Es el
 * comportamiento estándar de cualquier tabla de amortización real: preferimos
 * una última cuota con céntimos raros antes que un préstamo que no cuadra.
 */
function generarCuotas({ capital, tasaPorCuota, numeroCuotas }) {
  const principal = new Decimal(capital);
  const cuotaFija = calcularCuotaFija({ capital: principal, tasaPorCuota, numeroCuotas });

  let saldo = principal;

  return Array.from({ length: numeroCuotas }, (_, indice) => {
    const esUltima = indice === numeroCuotas - 1;
    const interes = dinero(saldo.times(tasaPorCuota));

    // La última liquida todo el saldo restante; el resto amortiza lo que sobra
    // de la cuota tras cubrir el interés.
    let capitalCuota = esUltima ? saldo : cuotaFija.minus(interes);

    // Redes de seguridad ante redondeos extremos: nunca amortizar de más ni
    // dejar que una cuota devuelva capital al cliente.
    if (capitalCuota.gt(saldo)) {
      capitalCuota = saldo;
    }
    if (capitalCuota.lt(0)) {
      capitalCuota = new Decimal(0);
    }

    saldo = saldo.minus(capitalCuota);

    return {
      capital: capitalCuota,
      interes,
      total: capitalCuota.plus(interes),
      saldoCapital: saldo,
    };
  });
}

module.exports = { generarCuotas, calcularCuotaFija };
