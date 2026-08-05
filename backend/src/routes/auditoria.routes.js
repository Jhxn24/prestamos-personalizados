const { Router } = require('express');
const auditoriaController = require('../modules/auditoria/auditoria.controller');
const { authGuard, requireRol } = require('../middlewares/authGuard');

const router = Router();

// RF-36: solo el administrador ve la bitácora de auditoría.
router.use(authGuard, requireRol('ADMINISTRADOR'));

router.get('/', auditoriaController.listar);

module.exports = router;
