const Decimal = require('decimal.js');
const { tasaPorCuota } = require('./tasas');
const { fechaVencimiento } = require('./fechas');
const { validarParametros } = require('./validaciones');
const interesFijo = require('./modalidades/interesFijo');
const interesSobreSaldo = require('./modalidades/interesSobreSaldo');
const cuotasFijas = require('./modalidades/cuotasFijas');

const GENERADORES = {
  INTERES_FIJO: interesFijo,
  INTERES_SOBRE_SALDO: interesSobreSaldo,
  CUOTAS_FIJAS: cuotasFijas,
};

/**
 * Genera el cronograma completo de un préstamo (RF-18).
 *
 * Es una función PURA: no toca base de datos ni HTTP. Devuelve montos como
 * Decimal para que la capa de persistencia decida cómo serializarlos.
 */
function generarCronograma(parametros) {
  validarParametros(parametros);

  const {
    capital,
    tasaInteres,
    tipoInteres,
    frecuenciaPago,
    diasPersonalizados,
    numeroCuotas,
    modalidad,
    fechaDesembolso,
  } = parametros;

  const tasa = tasaPorCuota({ tasaInteres, tipoInteres, frecuenciaPago, diasPersonalizados });

  const cuotas = GENERADORES[modalidad]
    .generarCuotas({ capital, tasaPorCuota: tasa, numeroCuotas })
    .map((cuota, indice) => ({
      numero: indice + 1,
      fechaVencimiento: fechaVencimiento({
        fechaDesembolso,
        frecuenciaPago,
        diasPersonalizados,
        numero: indice + 1,
      }),
      ...cuota,
    }));

  return { tasaPorCuota: tasa, cuotas, resumen: resumir(cuotas) };
}

function resumir(cuotas) {
  const cero = new Decimal(0);

  const totalCapital = cuotas.reduce((acumulado, cuota) => acumulado.plus(cuota.capital), cero);
  const totalInteres = cuotas.reduce((acumulado, cuota) => acumulado.plus(cuota.interes), cero);

  return {
    totalCapital,
    totalInteres,
    totalAPagar: totalCapital.plus(totalInteres),
    numeroCuotas: cuotas.length,
  };
}

module.exports = { generarCronograma };
