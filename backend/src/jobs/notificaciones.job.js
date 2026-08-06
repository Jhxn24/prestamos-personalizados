const cron = require('node-cron');
const notificacionesService = require('../modules/notificaciones/notificaciones.service');

const HORA_PERU = { timezone: 'America/Lima' };

/**
 * Barrido diario de notificaciones, siempre en hora de Perú
 * (independiente de en qué zona horaria corra el servidor):
 *
 * - 08:00 — RF-26 recordatorios de vencimiento, RF-28 resumen del
 *   administrador y el primer aviso de cobro por cliente.
 * - 20:00 — se repite el aviso de cobro por cliente (RF-28), por si el
 *   administrador se olvidó de cobrar en la mañana. Una cuota ya cobrada
 *   entre medio no vuelve a avisar (ver generarCobrosHoyPorCliente).
 *
 * Todas las funciones son idempotentes por corrida, así que no hay riesgo
 * de duplicar avisos si el proceso se reinicia.
 */
function iniciar() {
  cron.schedule(
    '0 8 * * *',
    async () => {
      try {
        await notificacionesService.generarRecordatoriosVencimiento();
        await notificacionesService.generarResumenAdmin();
        await notificacionesService.generarCobrosHoyPorCliente();
      } catch (error) {
        console.error('Error generando notificaciones programadas (08:00):', error);
      }
    },
    HORA_PERU
  );

  cron.schedule(
    '0 20 * * *',
    async () => {
      try {
        await notificacionesService.generarCobrosHoyPorCliente();
      } catch (error) {
        console.error('Error generando notificaciones programadas (20:00):', error);
      }
    },
    HORA_PERU
  );
}

module.exports = { iniciar };
