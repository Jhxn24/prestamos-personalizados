const prisma = require('../../config/prisma');
const pagosService = require('./pagos.service');
const { pagoDTO } = require('./pagos.dto');

const ERRORES_HTTP = {
  CUOTA_NO_ENCONTRADA: [404, 'Cuota no encontrada'],
  PAGO_NO_ENCONTRADO: [404, 'Pago no encontrado'],
  SIN_ACCESO: [403, 'No tienes acceso a este préstamo'],
};

function responderError(res, codigo) {
  const [estado, mensaje] = ERRORES_HTTP[codigo];
  return res.status(estado).json({ error: mensaje });
}

// RNF-05: el cliente solo ve lo suyo; el administrador no tiene restricción.
async function clienteIdDelUsuario(usuario) {
  if (usuario.rol === 'ADMINISTRADOR') {
    return null;
  }
  const cliente = await prisma.cliente.findUnique({ where: { usuarioId: usuario.id } });
  return cliente?.id ?? 'sin-cliente-asociado';
}

// RF-25: el administrador marca un pago como realizado; se aplica de inmediato.
async function registrar(req, res, next) {
  try {
    const { cuotaId, monto } = req.body;
    if (!cuotaId || monto === undefined) {
      return res.status(400).json({ error: 'cuotaId y monto son obligatorios' });
    }

    const { pago, error } = await pagosService.registrarPago(req.body, req.usuario.id);
    if (error) {
      return responderError(res, error);
    }

    res.status(201).json(pagoDTO(pago));
  } catch (error) {
    next(error);
  }
}

async function listar(req, res, next) {
  try {
    const clienteId = await clienteIdDelUsuario(req.usuario);
    const pagos = await pagosService.listarPagos({
      clienteId: clienteId ?? undefined,
      estado: req.query.estado,
      prestamoId: req.query.prestamoId,
    });
    res.json(pagos.map(pagoDTO));
  } catch (error) {
    next(error);
  }
}

async function obtener(req, res, next) {
  try {
    const pago = await pagosService.obtenerPagoPorId(req.params.id);
    if (!pago) {
      return responderError(res, 'PAGO_NO_ENCONTRADO');
    }

    const clienteId = await clienteIdDelUsuario(req.usuario);
    if (clienteId && pago.prestamo.clienteId !== clienteId) {
      return responderError(res, 'SIN_ACCESO');
    }

    res.json(pagoDTO(pago));
  } catch (error) {
    next(error);
  }
}

// Anula un pago marcado por error, revirtiendo su efecto en el préstamo.
async function anular(req, res, next) {
  try {
    const { pago, error } = await pagosService.anularPago(req.params.id, req.usuario.id, req.body?.motivo);
    if (error) {
      return responderError(res, error);
    }
    res.json(pagoDTO(pago));
  } catch (error) {
    next(error);
  }
}

module.exports = { registrar, listar, obtener, anular };
