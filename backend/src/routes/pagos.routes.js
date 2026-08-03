const { Router } = require('express');
const pagosController = require('../modules/pagos/pagos.controller');
const { authGuard, requireRol } = require('../middlewares/authGuard');

const router = Router();

router.use(authGuard);

// Ambos roles: el cliente reporta su pago (RF-21), el administrador lo registra
// directo (RF-25). El servicio distingue el caso según el rol.
router.post('/', pagosController.registrar);

// Lectura: el controlador restringe al cliente a sus propios pagos (RNF-05).
router.get('/', pagosController.listar);
router.get('/:id', pagosController.obtener);

// Resolución del pago reportado: solo administrador (RF-23).
router.post('/:id/confirmar', requireRol('ADMINISTRADOR'), pagosController.confirmar);
router.post('/:id/rechazar', requireRol('ADMINISTRADOR'), pagosController.rechazar);

module.exports = router;
