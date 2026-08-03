const { Router } = require('express');
const clientesController = require('../modules/clientes/clientes.controller');
const { authGuard, requireRol } = require('../middlewares/authGuard');

const router = Router();

router.use(authGuard, requireRol('ADMINISTRADOR'));

router.get('/', clientesController.listar);
router.get('/:id', clientesController.obtener);
router.post('/', clientesController.crear);
router.put('/:id', clientesController.actualizar);
router.patch('/:id/desactivar', clientesController.desactivar);

module.exports = router;
