/**
 * Motor de cálculo — API pública.
 *
 * Este módulo está deliberadamente aislado (RNF-09): no importa Express, Prisma
 * ni nada de infraestructura. Todo lo que expone son funciones puras sobre
 * Decimal, para poder probarlo exhaustivamente sin levantar el servidor ni la BD.
 */
const { generarCronograma } = require('./cronograma');
const { tasaPorCuota, diasDelPeriodo } = require('./tasas');
const { fechaVencimiento } = require('./fechas');
const { dinero, repartirCapital } = require('./redondeo');
const { distribuirPago, estadoDeCuota, recalcularCuotasPendientes } = require('./pagos');
const { diasEntre, calcularDiasAtraso, calcularMora, evaluarAtraso, POLITICAS_MORA } = require('./mora');
const { calcularInteresAnticipado, POLITICAS_INTERES_ANTICIPADO } = require('./anticipado');
const { calcularCuotaFija } = require('./modalidades/cuotasFijas');
const { recalcularPlazoReducido, POLITICAS_ABONO_EXTRAORDINARIO } = require('./plazo');
const { ErrorMotorCalculo, MODALIDADES_SOPORTADAS, TIPOS_INTERES, FRECUENCIAS } = require('./validaciones');

module.exports = {
  generarCronograma,
  tasaPorCuota,
  diasDelPeriodo,
  fechaVencimiento,
  dinero,
  repartirCapital,
  distribuirPago,
  estadoDeCuota,
  recalcularCuotasPendientes,
  diasEntre,
  calcularDiasAtraso,
  calcularMora,
  evaluarAtraso,
  calcularInteresAnticipado,
  calcularCuotaFija,
  recalcularPlazoReducido,
  POLITICAS_MORA,
  POLITICAS_INTERES_ANTICIPADO,
  POLITICAS_ABONO_EXTRAORDINARIO,
  ErrorMotorCalculo,
  MODALIDADES_SOPORTADAS,
  TIPOS_INTERES,
  FRECUENCIAS,
};
