const { Router } = require('express');
const pagosController = require('../modules/pagos/pagos.controller');
const { authGuard, requireRol } = require('../middlewares/authGuard');

const router = Router();

router.use(authGuard);

// RF-25: solo el administrador marca pagos; se aplican de inmediato.
router.post('/', requireRol('ADMINISTRADOR'), pagosController.registrar);

// Lectura: el controlador restringe al cliente a sus propios pagos (RNF-05).
router.get('/', pagosController.listar);
router.get('/:id', pagosController.obtener);

// Anular un pago marcado por error: solo administrador.
router.post('/:id/anular', requireRol('ADMINISTRADOR'), pagosController.anular);

module.exports = router;
