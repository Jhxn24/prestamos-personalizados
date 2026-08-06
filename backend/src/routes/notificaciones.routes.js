const { Router } = require('express');
const notificacionesController = require('../modules/notificaciones/notificaciones.controller');
const { authGuard, requireRol } = require('../middlewares/authGuard');

const router = Router();

router.use(authGuard);

router.get('/', notificacionesController.listar);
router.get('/no-leidas/contador', notificacionesController.contador);
router.post('/leer-todas', notificacionesController.marcarTodasLeidas);
router.post('/:id/leer', notificacionesController.marcarLeida);
router.post('/push-token', notificacionesController.registrarPushToken);

// Barrido diario (RF-26, RF-28): solo administrador puede forzarlo.
router.post('/generar', requireRol('ADMINISTRADOR'), notificacionesController.generar);

module.exports = router;
