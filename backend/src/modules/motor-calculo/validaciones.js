const Decimal = require('decimal.js');

const MODALIDADES_SOPORTADAS = ['INTERES_FIJO', 'INTERES_SOBRE_SALDO', 'CUOTAS_FIJAS'];
const TIPOS_INTERES = ['DIARIO', 'MENSUAL', 'ANUAL'];
const FRECUENCIAS = [
  'DIARIA',
  'SEMANAL',
  'QUINCENAL',
  'MENSUAL',
  'BIMESTRAL',
  'TRIMESTRAL',
  'PERSONALIZADA',
];

/**
 * Error de negocio del motor. El capa REST lo traduce a HTTP 400 en vez de 500,
 * porque son datos inválidos del administrador, no fallas del sistema.
 */
class ErrorMotorCalculo extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorMotorCalculo';
  }
}

function validarParametros({
  capital,
  tasaInteres,
  tipoInteres,
  frecuenciaPago,
  diasPersonalizados,
  numeroCuotas,
  modalidad,
  fechaDesembolso,
}) {
  const capitalDecimal = new Decimal(capital ?? NaN);
  if (capitalDecimal.isNaN() || capitalDecimal.lte(0)) {
    throw new ErrorMotorCalculo('El capital debe ser un monto mayor a 0');
  }

  const tasaDecimal = new Decimal(tasaInteres ?? NaN);
  if (tasaDecimal.isNaN() || tasaDecimal.lt(0)) {
    throw new ErrorMotorCalculo('La tasa de interés no puede ser negativa');
  }

  if (!TIPOS_INTERES.includes(tipoInteres)) {
    throw new ErrorMotorCalculo(`tipoInteres debe ser uno de: ${TIPOS_INTERES.join(', ')}`);
  }

  if (!FRECUENCIAS.includes(frecuenciaPago)) {
    throw new ErrorMotorCalculo(`frecuenciaPago debe ser una de: ${FRECUENCIAS.join(', ')}`);
  }

  if (frecuenciaPago === 'PERSONALIZADA' && (!Number.isInteger(diasPersonalizados) || diasPersonalizados <= 0)) {
    throw new ErrorMotorCalculo(
      'diasPersonalizados debe ser un entero mayor a 0 cuando la frecuencia es PERSONALIZADA'
    );
  }

  if (!Number.isInteger(numeroCuotas) || numeroCuotas <= 0) {
    throw new ErrorMotorCalculo('numeroCuotas debe ser un entero mayor a 0');
  }

  if (!MODALIDADES_SOPORTADAS.includes(modalidad)) {
    throw new ErrorMotorCalculo(`modalidad debe ser una de: ${MODALIDADES_SOPORTADAS.join(', ')}`);
  }

  if (!(fechaDesembolso instanceof Date) || Number.isNaN(fechaDesembolso.getTime())) {
    throw new ErrorMotorCalculo('fechaDesembolso debe ser una fecha válida');
  }
}

module.exports = {
  validarParametros,
  ErrorMotorCalculo,
  MODALIDADES_SOPORTADAS,
  TIPOS_INTERES,
  FRECUENCIAS,
};
