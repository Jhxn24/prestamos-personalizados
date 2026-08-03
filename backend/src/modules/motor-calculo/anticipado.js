const Decimal = require('decimal.js');
const { dinero } = require('./redondeo');
const { diasEntre } = require('./mora');
const { ErrorMotorCalculo } = require('./validaciones');

const POLITICAS_INTERES_ANTICIPADO = ['COMPLETO', 'PROPORCIONAL'];

/**
 * Interés a cobrar cuando la cuota se paga ANTES de su vencimiento (RF-14).
 *
 * El administrador decide entre dos políticas:
 *
 * - COMPLETO:     se cobra el interés íntegro del periodo. El cliente adelanta
 *                 el pago pero no se ahorra intereses.
 * - PROPORCIONAL: se cobra solo el interés devengado hasta la fecha del pago,
 *                 prorrateado por días transcurridos del periodo.
 *
 *     interes = interesCuota * diasTranscurridos / diasDelPeriodo
 *
 * El periodo va desde el vencimiento de la cuota anterior (o el desembolso, si
 * es la primera) hasta el vencimiento de esta cuota.
 *
 * Pagar en la fecha de vencimiento o después nunca reduce el interés: no hay
 * anticipo que premiar.
 */
function calcularInteresAnticipado({
  interesCuota,
  inicioPeriodo,
  fechaVencimiento,
  fechaPago,
  politica = 'COMPLETO',
}) {
  const interesCompleto = new Decimal(interesCuota);

  if (!POLITICAS_INTERES_ANTICIPADO.includes(politica)) {
    throw new ErrorMotorCalculo(
      `politicaInteresAnticipado debe ser una de: ${POLITICAS_INTERES_ANTICIPADO.join(', ')}`
    );
  }

  const sinDescuento = { interes: dinero(interesCompleto), condonado: new Decimal(0), anticipado: false };

  if (politica === 'COMPLETO') {
    return sinDescuento;
  }

  const diasPeriodo = diasEntre(inicioPeriodo, fechaVencimiento);
  const diasTranscurridos = diasEntre(inicioPeriodo, fechaPago);

  // Pago en o después del vencimiento: no es anticipado.
  if (diasPeriodo <= 0 || diasTranscurridos >= diasPeriodo) {
    return sinDescuento;
  }

  // Un pago anterior al inicio del periodo no puede generar interés negativo.
  const diasDevengados = Math.max(0, diasTranscurridos);

  const interesProporcional = dinero(interesCompleto.times(diasDevengados).div(diasPeriodo));

  return {
    interes: interesProporcional,
    condonado: dinero(interesCompleto.minus(interesProporcional)),
    anticipado: true,
    diasDevengados,
    diasPeriodo,
  };
}

module.exports = { calcularInteresAnticipado, POLITICAS_INTERES_ANTICIPADO };
