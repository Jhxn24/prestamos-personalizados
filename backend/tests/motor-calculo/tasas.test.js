const test = require('node:test');
const assert = require('node:assert/strict');
const { tasaPorCuota, diasDelPeriodo } = require('../../src/modules/motor-calculo');

/**
 * La conversión de tasa es la regla de negocio más fácil de equivocar:
 * un error del 30x aquí (mensual tratado como diario) multiplica la deuda real.
 */

test('tasa mensual con pago mensual se aplica tal cual', () => {
  const tasa = tasaPorCuota({ tasaInteres: 5, tipoInteres: 'MENSUAL', frecuenciaPago: 'MENSUAL' });
  assert.equal(tasa.toString(), '0.05');
});

test('tasa anual con pago mensual se divide en 12 periodos (base 360)', () => {
  const tasa = tasaPorCuota({ tasaInteres: 36, tipoInteres: 'ANUAL', frecuenciaPago: 'MENSUAL' });
  assert.equal(tasa.toString(), '0.03');
});

test('tasa anual con pago anual equivalente (trimestral x4) mantiene proporción', () => {
  const tasa = tasaPorCuota({ tasaInteres: 36, tipoInteres: 'ANUAL', frecuenciaPago: 'TRIMESTRAL' });
  assert.equal(tasa.toString(), '0.09');
});

test('tasa diaria con pago semanal multiplica por 7', () => {
  const tasa = tasaPorCuota({ tasaInteres: 1, tipoInteres: 'DIARIO', frecuenciaPago: 'SEMANAL' });
  assert.equal(tasa.toString(), '0.07');
});

test('tasa mensual con pago diario divide entre 30', () => {
  const tasa = tasaPorCuota({ tasaInteres: 30, tipoInteres: 'MENSUAL', frecuenciaPago: 'DIARIA' });
  assert.equal(tasa.toString(), '0.01');
});

test('tasa mensual con pago quincenal es la mitad', () => {
  const tasa = tasaPorCuota({ tasaInteres: 10, tipoInteres: 'MENSUAL', frecuenciaPago: 'QUINCENAL' });
  assert.equal(tasa.toString(), '0.05');
});

test('tasa mensual con pago bimestral es el doble', () => {
  const tasa = tasaPorCuota({ tasaInteres: 4, tipoInteres: 'MENSUAL', frecuenciaPago: 'BIMESTRAL' });
  assert.equal(tasa.toString(), '0.08');
});

test('frecuencia personalizada usa los días indicados', () => {
  const tasa = tasaPorCuota({
    tasaInteres: 30,
    tipoInteres: 'MENSUAL',
    frecuenciaPago: 'PERSONALIZADA',
    diasPersonalizados: 10,
  });
  assert.equal(tasa.toString(), '0.1');
});

test('la conversión no pierde precisión en tasas no exactas', () => {
  // 5% mensual cobrado semanal: 5/30*7 = 1.1666...% -> Decimal conserva la precisión
  const tasa = tasaPorCuota({ tasaInteres: 5, tipoInteres: 'MENSUAL', frecuenciaPago: 'SEMANAL' });
  assert.ok(tasa.minus('0.0116666666').abs().lt('0.0000001'));

  // Y multiplicada de vuelta por 30/7 recupera exactamente el 5% mensual
  assert.equal(tasa.times(30).div(7).times(100).toDecimalPlaces(10).toString(), '5');
});

test('tasa 0 es válida (préstamo sin interés)', () => {
  const tasa = tasaPorCuota({ tasaInteres: 0, tipoInteres: 'MENSUAL', frecuenciaPago: 'MENSUAL' });
  assert.equal(tasa.toString(), '0');
});

test('PERSONALIZADA sin diasPersonalizados falla en vez de asumir un default', () => {
  assert.throws(
    () => tasaPorCuota({ tasaInteres: 5, tipoInteres: 'MENSUAL', frecuenciaPago: 'PERSONALIZADA' }),
    /diasPersonalizados/
  );
});

test('diasDelPeriodo cubre todas las frecuencias fijas', () => {
  assert.equal(diasDelPeriodo('DIARIA'), 1);
  assert.equal(diasDelPeriodo('SEMANAL'), 7);
  assert.equal(diasDelPeriodo('QUINCENAL'), 15);
  assert.equal(diasDelPeriodo('MENSUAL'), 30);
  assert.equal(diasDelPeriodo('BIMESTRAL'), 60);
  assert.equal(diasDelPeriodo('TRIMESTRAL'), 90);
});
