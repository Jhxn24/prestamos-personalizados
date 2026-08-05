const cron = require('node-cron');
const notificacionesService = require('../modules/notificaciones/notificaciones.service');

/**
 * Barrido diario de notificaciones (RF-26 recordatorios de vencimiento,
 * RF-28 resumen del administrador). Corre todos los días a las 08:00, hora
 * del servidor. Ambas funciones son idempotentes por día, así que no hay
 * riesgo de duplicar avisos si el proceso se reinicia.
 */
function iniciar() {
  cron.schedule('0 8 * * *', async () => {
    try {
      await notificacionesService.generarRecordatoriosVencimiento();
      await notificacionesService.generarResumenAdmin();
    } catch (error) {
      console.error('Error generando notificaciones programadas:', error);
    }
  });
}

module.exports = { iniciar };
