const Decimal = require('decimal.js');
const { dinero } = require('./redondeo');

const MS_POR_DIA = 86400000;

const POLITICAS_MORA = ['NINGUNA', 'EXTENSION_DIA', 'COBRO_DOBLE', 'MORA'];

/**
 * Diferencia en días de CALENDARIO entre dos fechas, ignorando la hora.
 *
 * Comparar timestamps crudos haría que un pago a las 23:00 del día de
 * vencimiento contara como un día de atraso. El atraso es un concepto de
 * calendario, no de reloj.
 */
function diasEntre(desde, hasta) {
  const inicio = Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate());
  const fin = Date.UTC(hasta.getUTCFullYear(), hasta.getUTCMonth(), hasta.getUTCDate());
  return Math.round((fin - inicio) / MS_POR_DIA);
}

/**
 * Días de atraso efectivos de una cuota, descontando los días de gracia
 * pactados. Nunca es negativo: una cuota pagada antes de tiempo tiene 0.
 */
function calcularDiasAtraso({ fechaVencimiento, fechaReferencia, diasGracia = 0 }) {
  const transcurridos = diasEntre(fechaVencimiento, fechaReferencia);
  return Math.max(0, transcurridos - diasGracia);
}

/**
 * Mora acumulada de una cuota vencida (RF-16).
 *
 * Se calcula SOLO sobre el capital que la cuota todavía debe, no sobre su total:
 * el interés no genera mora, para no cobrar interés sobre interés.
 *
 *   mora = capitalPendienteDeLaCuota * (tasaMoraDiaria / 100) * diasAtraso
 *
 * Es una función del atraso total, no un acumulador: recalcularla dos veces el
 * mismo día da el mismo resultado. Esa idempotencia es lo que permite refrescar
 * la mora en cada consulta sin inflarla.
 */
function calcularMora({ capitalPendienteCuota, tasaMoraDiaria, diasAtraso }) {
  if (diasAtraso <= 0) {
    return new Decimal(0);
  }

  const capital = new Decimal(capitalPendienteCuota);
  if (capital.lte(0)) {
    return new Decimal(0);
  }

  return dinero(capital.times(new Decimal(tasaMoraDiaria).div(100)).times(diasAtraso));
}

/**
 * Resuelve qué hacer con una cuota abierta según la política de atraso del
 * préstamo (RF-16). Devuelve la decisión; no escribe nada.
 *
 * - NINGUNA:       se marca vencida, sin cargo.
 * - COBRO_DOBLE:   se marca vencida, sin cargo. El "doble" es la acumulación
 *                  natural: al llegar la siguiente cuota el cliente debe ambas.
 * - EXTENSION_DIA: se corre el vencimiento un día, UNA sola vez. Aplicarla en
 *                  cada refresco convertiría la cuota en una deuda que nunca vence.
 * - MORA:          se marca vencida y se cobra mora sobre el capital pendiente.
 */
function evaluarAtraso({
  politicaMora,
  fechaVencimiento,
  fechaReferencia,
  diasGracia = 0,
  tasaMoraDiaria = 0,
  capitalPendienteCuota,
  extensionAplicada = false,
}) {
  const diasAtraso = calcularDiasAtraso({ fechaVencimiento, fechaReferencia, diasGracia });

  if (diasAtraso <= 0) {
    return { diasAtraso: 0, mora: new Decimal(0), vencida: false, nuevaFechaVencimiento: null };
  }

  if (politicaMora === 'EXTENSION_DIA' && !extensionAplicada) {
    const extendida = new Date(fechaVencimiento.getTime());
    extendida.setUTCDate(extendida.getUTCDate() + 1);

    const atrasoTrasExtension = calcularDiasAtraso({
      fechaVencimiento: extendida,
      fechaReferencia,
      diasGracia,
    });

    return {
      diasAtraso: atrasoTrasExtension,
      mora: new Decimal(0),
      vencida: atrasoTrasExtension > 0,
      nuevaFechaVencimiento: extendida,
    };
  }

  const mora =
    politicaMora === 'MORA'
      ? calcularMora({ capitalPendienteCuota, tasaMoraDiaria, diasAtraso })
      : new Decimal(0);

  return { diasAtraso, mora, vencida: true, nuevaFechaVencimiento: null };
}

module.exports = { diasEntre, calcularDiasAtraso, calcularMora, evaluarAtraso, POLITICAS_MORA };
