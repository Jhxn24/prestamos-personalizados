require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const clientesRoutes = require('./routes/clientes.routes');
const prestamosRoutes = require('./routes/prestamos.routes');
const pagosRoutes = require('./routes/pagos.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const notificacionesRoutes = require('./routes/notificaciones.routes');
const auditoriaRoutes = require('./routes/auditoria.routes');
const sistemaRoutes = require('./routes/sistema.routes');
const errorHandler = require('./middlewares/errorHandler');
const notificacionesJob = require('./jobs/notificaciones.job');

const app = express();

app.use(cors());
app.use(express.json());

// Usado por el health check del hosting (Railway/Render/etc.) para saber si el servicio está vivo.
app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/prestamos', prestamosRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/auditoria', auditoriaRoutes);
app.use('/api/sistema', sistemaRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
  notificacionesJob.iniciar();
});
