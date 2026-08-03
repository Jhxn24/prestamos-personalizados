/**
 * Cálculo de fechas de vencimiento del cronograma.
 *
 * Las frecuencias que son múltiplos de mes avanzan por CALENDARIO (no por 30 días
 * fijos), porque un cliente que paga el 31 de enero espera pagar a fin de febrero,
 * no el 2 de marzo. Los días se recortan al último día del mes cuando el día
 * original no existe (31 ene + 1 mes = 28/29 feb).
 *
 * Las demás frecuencias avanzan por días corridos.
 */

const MESES_POR_PERIODO = {
  MENSUAL: 1,
  BIMESTRAL: 2,
  TRIMESTRAL: 3,
};

const DIAS_CORRIDOS_POR_PERIODO = {
  DIARIA: 1,
  SEMANAL: 7,
  QUINCENAL: 15,
};

function agregarDias(fecha, dias) {
  const resultado = new Date(fecha.getTime());
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado;
}

function agregarMeses(fecha, meses) {
  const resultado = new Date(fecha.getTime());
  const diaOriginal = resultado.getUTCDate();

  resultado.setUTCMonth(resultado.getUTCMonth() + meses);

  // Si el día se desbordó (31 ene -> 3 mar), retrocede al último día del mes correcto.
  if (resultado.getUTCDate() < diaOriginal) {
    resultado.setUTCDate(0);
  }

  return resultado;
}

/**
 * Fecha de vencimiento de la cuota `numero` (1-indexado) contada desde el desembolso.
 */
function fechaVencimiento({ fechaDesembolso, frecuenciaPago, diasPersonalizados, numero }) {
  const base = new Date(fechaDesembolso.getTime());

  const meses = MESES_POR_PERIODO[frecuenciaPago];
  if (meses) {
    return agregarMeses(base, meses * numero);
  }

  const dias =
    frecuenciaPago === 'PERSONALIZADA' ? diasPersonalizados : DIAS_CORRIDOS_POR_PERIODO[frecuenciaPago];

  if (!dias) {
    throw new Error(`Frecuencia de pago no soportada: ${frecuenciaPago}`);
  }

  return agregarDias(base, dias * numero);
}

module.exports = { fechaVencimiento, agregarDias, agregarMeses };
