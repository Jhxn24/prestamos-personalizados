const Decimal = require('decimal.js');
const { dinero } = require('./redondeo');
const { ErrorMotorCalculo } = require('./validaciones');

const POLITICAS_ABONO_EXTRAORDINARIO = ['REDUCIR_CUOTA', 'REDUCIR_PLAZO'];

// Tope defensivo del bucle de amortización: un préstamo real nunca necesita
// tantos periodos, así que llegar aquí significa que la cuota no amortiza.
const MAX_CUOTAS = 1000;

/**
 * RF-17 — abono extraordinario con REDUCIR_PLAZO.
 *
 * La diferencia con REDUCIR_CUOTA está en qué se mantiene constante:
 *
 *   REDUCIR_CUOTA: se conserva el NÚMERO de cuotas y baja lo que se paga en cada una.
 *   REDUCIR_PLAZO: se conserva el IMPORTE de la cuota y hacen falta menos cuotas.
 *
 * Aquí se amortiza al ritmo pactado originalmente hasta agotar el saldo. La
 * última cuota es la que queda corta, porque el saldo casi nunca es múltiplo
 * exacto de la cuota.
 */
function recalcularPlazoReducido({
  saldoInicial,
  capitalARepartir,
  capitalOriginal,
  capitalPorCuotaOriginal,
  cuotaFijaOriginal,
  tasaPorCuota,
  modalidad,
  maximoCuotas,
}) {
  const capitalTotal = new Decimal(capitalARepartir);

  if (capitalTotal.lte(0)) {
    return [];
  }

  const cuotas =
    modalidad === 'CUOTAS_FIJAS'
      ? amortizarConCuotaConstante({ capitalTotal, cuotaFijaOriginal, tasaPorCuota })
      : amortizarConCapitalConstante({
          capitalTotal,
          saldoInicial: new Decimal(saldoInicial),
          capitalOriginal,
          capitalPorCuotaOriginal,
          tasaPorCuota,
          modalidad,
        });

  // Nunca alargar el préstamo: esta política solo puede acortarlo. Si por
  // cuotas anteriores impagas hicieran falta más periodos de los que quedan,
  // se comprimen en los disponibles y la última absorbe el resto.
  if (maximoCuotas && cuotas.length > maximoCuotas) {
    return comprimirEn(cuotas, maximoCuotas, { saldoInicial, capitalTotal, tasaPorCuota, modalidad, capitalOriginal });
  }

  return cuotas;
}

/**
 * Interés fijo y sobre saldo: el capital se amortiza a razón de la cuota
 * original hasta agotar el saldo.
 */
function amortizarConCapitalConstante({
  capitalTotal,
  saldoInicial,
  capitalOriginal,
  capitalPorCuotaOriginal,
  tasaPorCuota,
  modalidad,
}) {
  const porCuota = new Decimal(capitalPorCuotaOriginal);

  if (porCuota.lte(0)) {
    throw new ErrorMotorCalculo('El capital por cuota original debe ser mayor a 0 para reducir el plazo');
  }

  const interesFijoPorCuota =
    modalidad === 'INTERES_FIJO' ? dinero(new Decimal(capitalOriginal).times(tasaPorCuota)) : null;

  const cuotas = [];
  let porAmortizar = capitalTotal;
  let saldo = saldoInicial;

  while (porAmortizar.gt(0) && cuotas.length < MAX_CUOTAS) {
    const capitalCuota = Decimal.min(porAmortizar, porCuota);
    const interesCuota = interesFijoPorCuota ?? dinero(saldo.times(tasaPorCuota));

    porAmortizar = porAmortizar.minus(capitalCuota);
    saldo = saldo.minus(capitalCuota);

    cuotas.push({
      capital: capitalCuota,
      interes: interesCuota,
      total: capitalCuota.plus(interesCuota),
      saldoCapital: saldo,
    });
  }

  return cuotas;
}

/**
 * Cuotas fijas: se mantiene el importe de la anualidad original y se amortiza
 * hasta agotar el saldo. Como la cuota no cambia pero el saldo bajó, hacen
 * falta menos periodos.
 */
function amortizarConCuotaConstante({ capitalTotal, cuotaFijaOriginal, tasaPorCuota }) {
  const cuotaFija = new Decimal(cuotaFijaOriginal);
  const cuotas = [];
  let saldo = capitalTotal;

  while (saldo.gt(0) && cuotas.length < MAX_CUOTAS) {
    const interesCuota = dinero(saldo.times(tasaPorCuota));
    let capitalCuota = cuotaFija.minus(interesCuota);

    if (capitalCuota.lte(0)) {
      throw new ErrorMotorCalculo(
        'La cuota pactada no alcanza a cubrir el interés del periodo: el préstamo nunca se amortizaría'
      );
    }

    capitalCuota = Decimal.min(capitalCuota, saldo);
    saldo = saldo.minus(capitalCuota);

    cuotas.push({
      capital: capitalCuota,
      interes: interesCuota,
      total: capitalCuota.plus(interesCuota),
      saldoCapital: saldo,
    });
  }

  return cuotas;
}

/**
 * Reparte el capital en exactamente `maximo` cuotas cuando el ritmo original
 * no cabría en las que quedan. Es una salvaguarda, no el camino normal.
 */
function comprimirEn(cuotas, maximo, { saldoInicial, capitalTotal, tasaPorCuota, modalidad, capitalOriginal }) {
  const base = capitalTotal.div(maximo).toDecimalPlaces(2, Decimal.ROUND_DOWN);
  const partes = Array.from({ length: maximo }, () => base);
  partes[maximo - 1] = base.plus(capitalTotal.minus(base.times(maximo)));

  const interesFijoPorCuota =
    modalidad === 'INTERES_FIJO' ? dinero(new Decimal(capitalOriginal).times(tasaPorCuota)) : null;

  let saldo = new Decimal(saldoInicial);

  return partes.map((capitalCuota) => {
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

module.exports = { recalcularPlazoReducido, POLITICAS_ABONO_EXTRAORDINARIO };
