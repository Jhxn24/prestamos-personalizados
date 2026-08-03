const Decimal = require('decimal.js');

/**
 * Conversión de tasas — base 30/360.
 *
 * La tasa se pacta en un periodo (tipoInteres) que no necesariamente coincide
 * con el periodo de cobro (frecuenciaPago). Para obtener la tasa que se aplica
 * en CADA cuota se normaliza la tasa pactada a tasa diaria y se multiplica por
 * los días que dura el periodo de cobro:
 *
 *   tasaPorCuota = tasaInteres / DIAS_BASE_TASA[tipoInteres] * DIAS_POR_PERIODO[frecuenciaPago]
 *
 * Con base 30/360 las combinaciones naturales quedan exactas:
 *   5% MENSUAL  + pago MENSUAL  -> 5/30*30  = 5%
 *   36% ANUAL   + pago MENSUAL  -> 36/360*30 = 3%
 *   1% DIARIO   + pago SEMANAL  -> 1/1*7    = 7%
 */

const DIAS_BASE_TASA = {
  DIARIO: 1,
  MENSUAL: 30,
  ANUAL: 360,
};

const DIAS_POR_PERIODO = {
  DIARIA: 1,
  SEMANAL: 7,
  QUINCENAL: 15,
  MENSUAL: 30,
  BIMESTRAL: 60,
  TRIMESTRAL: 90,
};

/**
 * Días que dura un periodo de cobro. PERSONALIZADA exige diasPersonalizados.
 */
function diasDelPeriodo(frecuenciaPago, diasPersonalizados) {
  if (frecuenciaPago === 'PERSONALIZADA') {
    if (!Number.isInteger(diasPersonalizados) || diasPersonalizados <= 0) {
      throw new Error('diasPersonalizados debe ser un entero mayor a 0 para frecuencia PERSONALIZADA');
    }
    return diasPersonalizados;
  }

  const dias = DIAS_POR_PERIODO[frecuenciaPago];
  if (!dias) {
    throw new Error(`Frecuencia de pago no soportada: ${frecuenciaPago}`);
  }
  return dias;
}

/**
 * Devuelve la tasa aplicable a una cuota como FRACCIÓN (0.05 = 5%),
 * no como porcentaje, para poder multiplicarla directamente por el capital.
 */
function tasaPorCuota({ tasaInteres, tipoInteres, frecuenciaPago, diasPersonalizados }) {
  const base = DIAS_BASE_TASA[tipoInteres];
  if (!base) {
    throw new Error(`Tipo de interés no soportado: ${tipoInteres}`);
  }

  const dias = diasDelPeriodo(frecuenciaPago, diasPersonalizados);

  // Se multiplica ANTES de dividir: dividir primero (5/30 = 0.1666...) arrastra
  // el truncamiento de la división a través del resto del cálculo y produce
  // 0.050000000000000000001 en vez de 0.05 exacto.
  return new Decimal(tasaInteres).times(dias).div(base).div(100);
}

module.exports = { tasaPorCuota, diasDelPeriodo, DIAS_BASE_TASA, DIAS_POR_PERIODO };
