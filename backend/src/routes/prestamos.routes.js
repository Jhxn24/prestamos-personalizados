const { Router } = require('express');
const prestamosController = require('../modules/prestamos/prestamos.controller');
const { authGuard, requireRol } = require('../middlewares/authGuard');

const router = Router();

router.use(authGuard);

// Lectura: ambos roles (RF-20). El controlador restringe al cliente a lo suyo (RNF-05).
router.get('/', prestamosController.listar);
router.get('/:id', prestamosController.obtener);
router.get('/:id/cronograma', prestamosController.cronograma);

// Escritura y simulación: solo administrador (RF-05, RF-08, RF-09).
router.post('/simular', requireRol('ADMINISTRADOR'), prestamosController.simular);
router.post('/', requireRol('ADMINISTRADOR'), prestamosController.crear);
router.post('/:id/recalcular', requireRol('ADMINISTRADOR'), prestamosController.recalcular);
router.post('/:id/refinanciar', requireRol('ADMINISTRADOR'), prestamosController.refinanciar);
router.post('/:id/actualizar-mora', requireRol('ADMINISTRADOR'), prestamosController.actualizarMora);

module.exports = router;
