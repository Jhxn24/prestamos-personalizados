const clientesService = require('./clientes.service');
const { clienteDTO } = require('./clientes.dto');

async function listar(req, res, next) {
  try {
    const clientes = await clientesService.listarClientes();
    res.json(clientes.map(clienteDTO));
  } catch (error) {
    next(error);
  }
}

async function obtener(req, res, next) {
  try {
    const cliente = await clientesService.obtenerClientePorId(req.params.id);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    res.json(clienteDTO(cliente));
  } catch (error) {
    next(error);
  }
}

async function crear(req, res, next) {
  try {
    const { nombre, apellido, documento, email, password } = req.body;
    if (!nombre || !apellido || !documento || !email || !password) {
      return res.status(400).json({
        error: 'nombre, apellido, documento, email y password son obligatorios',
      });
    }

    const cliente = await clientesService.crearCliente(req.body, req.usuario.id);
    res.status(201).json(clienteDTO(cliente));
  } catch (error) {
    next(error);
  }
}

async function actualizar(req, res, next) {
  try {
    const cliente = await clientesService.actualizarCliente(req.params.id, req.body, req.usuario.id);
    res.json(clienteDTO(cliente));
  } catch (error) {
    next(error);
  }
}

async function desactivar(req, res, next) {
  try {
    const cliente = await clientesService.desactivarCliente(req.params.id, req.usuario.id);
    res.json(clienteDTO(cliente));
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, obtener, crear, actualizar, desactivar };
