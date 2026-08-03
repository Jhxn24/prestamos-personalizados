const prisma = require('../../config/prisma');
const prestamosService = require('./prestamos.service');
const { refrescarMora } = require('../mora/mora.service');

/**
 * RNF-05: un cliente solo puede ver sus propios préstamos. Resuelve el
 * clienteId a partir del usuario autenticado; para el administrador devuelve
 * null (sin restricción).
 */
async function clienteIdDelUsuario(usuario) {
  if (usuario.rol === 'ADMINISTRADOR') {
    return null;
  }

  const cliente = await prisma.cliente.findUnique({ where: { usuarioId: usuario.id } });
  return cliente?.id ?? 'sin-cliente-asociado';
}

async function listar(req, res, next) {
  try {
    const clienteId = await clienteIdDelUsuario(req.usuario);
    const prestamos = await prestamosService.listarPrestamos(clienteId ? { clienteId } : {});
    res.json(prestamos);
  } catch (error) {
    next(error);
  }
}

async function obtener(req, res, next) {
  try {
    const prestamo = await prestamosService.obtenerPrestamoPorId(req.params.id);
    if (!prestamo) {
      return res.status(404).json({ error: 'Préstamo no encontrado' });
    }

    const clienteId = await clienteIdDelUsuario(req.usuario);
    if (clienteId && prestamo.clienteId !== clienteId) {
      return res.status(403).json({ error: 'No tienes acceso a este préstamo' });
    }

    res.json(prestamo);
  } catch (error) {
    next(error);
  }
}

// RF-20: cliente y administrador ven la versión vigente del cronograma.
async function cronograma(req, res, next) {
  try {
    const prestamo = await prestamosService.obtenerPrestamoPorId(req.params.id);
    if (!prestamo) {
      return res.status(404).json({ error: 'Préstamo no encontrado' });
    }

    const clienteId = await clienteIdDelUsuario(req.usuario);
    if (clienteId && prestamo.clienteId !== clienteId) {
      return res.status(403).json({ error: 'No tienes acceso a este préstamo' });
    }

    res.json(prestamo.cuotas);
  } catch (error) {
    next(error);
  }
}

async function crear(req, res, next) {
  try {
    const { clienteId, capital, tasaInteres, tipoInteres, frecuenciaPago, numeroCuotas, modalidad } =
      req.body;

    if (
      !clienteId ||
      capital === undefined ||
      tasaInteres === undefined ||
      !tipoInteres ||
      !frecuenciaPago ||
      numeroCuotas === undefined ||
      !modalidad
    ) {
      return res.status(400).json({
        error:
          'clienteId, capital, tasaInteres, tipoInteres, frecuenciaPago, numeroCuotas y modalidad son obligatorios',
      });
    }

    const prestamo = await prestamosService.crearPrestamo(req.body);
    res.status(201).json(prestamo);
  } catch (error) {
    next(error);
  }
}

// Previsualiza un cronograma sin guardarlo, para que el administrador compare
// condiciones antes de comprometer el préstamo.
async function simular(req, res, next) {
  try {
    res.json(prestamosService.simular(req.body));
  } catch (error) {
    next(error);
  }
}

async function recalcular(req, res, next) {
  try {
    const prestamo = await prestamosService.recalcularPrestamo(req.params.id, req.body ?? {});
    if (!prestamo) {
      return res.status(404).json({ error: 'Préstamo no encontrado' });
    }
    res.json(prestamo);
  } catch (error) {
    next(error);
  }
}

async function refinanciar(req, res, next) {
  try {
    const prestamo = await prestamosService.refinanciarPrestamo(req.params.id, req.body ?? {});
    if (!prestamo) {
      return res.status(404).json({ error: 'Préstamo no encontrado' });
    }
    res.status(201).json(prestamo);
  } catch (error) {
    next(error);
  }
}

// RF-16: recalcula atraso y mora a la fecha. Es idempotente, así que el panel
// puede llamarlo cada vez que muestre el préstamo sin inflar la deuda.
async function actualizarMora(req, res, next) {
  try {
    const fechaReferencia = req.body?.fechaReferencia ? new Date(req.body.fechaReferencia) : new Date();
    const prestamo = await refrescarMora(req.params.id, fechaReferencia);

    if (!prestamo) {
      return res.status(404).json({ error: 'Préstamo no encontrado' });
    }

    res.json(prestamo);
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, obtener, cronograma, crear, simular, recalcular, refinanciar, actualizarMora };
