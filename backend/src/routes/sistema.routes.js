const { Router } = require('express');
const sistemaController = require('../modules/sistema/sistema.controller');
const { authGuard, requireRol } = require('../middlewares/authGuard');

const router = Router();

router.use(authGuard, requireRol('ADMINISTRADOR'));

// Borra todos los clientes, préstamos, cuotas, pagos y cuentas de cliente.
// Irreversible — exige la frase de confirmación exacta y la contraseña del admin.
router.post('/purgar-datos', sistemaController.purgarDatos);

module.exports = router;
