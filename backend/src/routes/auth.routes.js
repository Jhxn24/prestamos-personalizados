const { Router } = require('express');
const authController = require('../modules/auth/auth.controller');
const { authGuard } = require('../middlewares/authGuard');

const router = Router();

router.get('/setup-requerido', authController.setupRequerido);
router.post('/registrar-admin', authController.registrarAdmin);
router.post('/login', authController.login);
router.post('/cambiar-password', authGuard, authController.cambiarPassword);

module.exports = router;
