const Decimal = require('decimal.js');
const { dinero, repartirCapital } = require('./redondeo');
const { ErrorMotorCalculo } = require('./validaciones');
const cuotasFijas = require('./modalidades/cuotasFijas');

/**
 * Distribución de un pago sobre una cuota — cascada mora → interés → capital.
 *
 * La mora se cobra primero (es el recargo por el incumplimiento) y el interés
 * antes que el capital: es la práctica estándar de la industria y es lo que
 * permite que exista el caso "pago que cubre solo intereses, dejando el capital
 * intacto" (RF-12).
 *
 * Lo que sobre después de saldar mora, interés y capital de la cuota queda como
 * `excedente`, que el llamador decide cómo aplicar (abono extraordinario).
 */
function distribuirPago({ monto, moraPendiente = 0, interesPendiente, capitalPendiente }) {
  const montoDecimal = new Decimal(monto);

  if (montoDecimal.lte(0)) {
    throw new ErrorMotorCalculo('El monto del pago debe ser mayor a 0');
  }

  const moraAplicada = Decimal.min(montoDecimal, new Decimal(moraPendiente));
  const trasMora = montoDecimal.minus(moraAplicada);

  const interesAplicado = Decimal.min(trasMora, new Decimal(interesPendiente));
  const restante = trasMora.minus(interesAplicado);

  const capitalAplicado = Decimal.min(restante, new Decimal(capitalPendiente));
  const excedente = restante.minus(capitalAplicado);

  return {
    moraAplicada: dinero(moraAplicada),
    interesAplicado: dinero(interesAplicado),
    capitalAplicado: dinero(capitalAplicado),
    excedente: dinero(excedente),
  };
}

/**
 * Estado de una cuota según lo pagado (RF-15: soporta pagos parciales).
 *
 * Lo exigible incluye la mora devengada: una cuota con mora pendiente no está
 * saldada aunque se haya cubierto capital e interés. `vencida` viene de la
 * política de atraso (RF-16) y tiene prioridad sobre PARCIAL, porque lo que el
 * administrador necesita ver es a quién cobrarle.
 */
function estadoDeCuota({ montoPagado, total, mora = 0, vencida = false }) {
  const pagado = new Decimal(montoPagado);
  const exigible = new Decimal(total).plus(new Decimal(mora));

  if (exigible.lte(0) || pagado.gte(exigible)) {
    return 'PAGADA';
  }
  if (pagado.lte(0)) {
    return vencida ? 'VENCIDA' : 'PENDIENTE';
  }
  return vencida ? 'VENCIDA' : 'PARCIAL';
}

/**
 * Recalcula las cuotas que todavía no se han tocado, después de un pago (RF-11, RF-19).
 *
 * - `saldoInicial`: capital pendiente REAL del préstamo. Es la base sobre la que
 *   se cobra interés en la modalidad sobre saldo.
 * - `capitalARepartir`: cuánto capital deben amortizar estas cuotas. Normalmente
 *   coincide con `saldoInicial`, pero es menor si alguna cuota anterior quedó
 *   parcialmente pagada y conserva su propio saldo de capital por cobrar.
 * - `capitalOriginal`: capital con el que nació el préstamo. Solo lo usa la
 *   modalidad de interés fijo, donde el interés NO baja aunque se abone capital.
 *
 * Las fechas de vencimiento no se tocan: el cliente pactó esas fechas y un pago
 * no debe moverlas. Lo que cambia es el reparto de capital e interés.
 */
function recalcularCuotasPendientes({
  saldoInicial,
  capitalARepartir,
  capitalOriginal,
  tasaPorCuota,
  modalidad,
  numeroCuotasPendientes,
}) {
  if (numeroCuotasPendientes <= 0) {
    return [];
  }

  // En cuotas fijas hay que rehacer la anualidad sobre el saldo que queda: no
  // basta con repartir capital, porque la cuota constante depende del capital,
  // la tasa y el número de cuotas a la vez.
  //
  // Se usa `capitalARepartir` como base. En el flujo normal coincide con el
  // saldo real; solo difieren si una cuota anterior quedó parcial, en cuyo caso
  // ese resto no devenga interés en las cuotas futuras (se cobra de menos).
  if (modalidad === 'CUOTAS_FIJAS') {
    return cuotasFijas.generarCuotas({
      capital: capitalARepartir,
      tasaPorCuota,
      numeroCuotas: numeroCuotasPendientes,
    });
  }

  const partesCapital = repartirCapital(new Decimal(capitalARepartir), numeroCuotasPendientes);

  // En interés fijo el interés se congela sobre el capital inicial (requerimientos.md §8),
  // así que abonar capital por adelantado NO reduce el interés de las cuotas futuras.
  const interesFijoPorCuota =
    modalidad === 'INTERES_FIJO' ? dinero(new Decimal(capitalOriginal).times(tasaPorCuota)) : null;

  let saldo = new Decimal(saldoInicial);

  return partesCapital.map((capitalCuota) => {
    const interesCuota = interesFijoPorCuota ?? dinero(saldo.times(tasaPorCuota));
    saldo = saldo.minus(capitalCuota);

    return {
      capital: capitalCuota,
      interes: interesCuota,
      total: capitalCuota.plus(interesCuota),
      saldoCapital: saldo,
    };
  });
}

module.exports = { distribuirPago, estadoDeCuota, recalcularCuotasPendientes };
