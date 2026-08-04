const { Router } = require('express');
const dashboardController = require('../modules/dashboard/dashboard.controller');
const { authGuard } = require('../middlewares/authGuard');

const router = Router();

router.use(authGuard);

// El controlador decide la vista según el rol (RF-29 administrador, RF-30 cliente).
router.get('/', dashboardController.resumen);

module.exports = router;
