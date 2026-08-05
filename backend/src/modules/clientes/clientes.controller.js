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
    if (!nombre || !apellido || !documento) {
      return res.status(400).json({
        error: 'nombre, apellido y documento son obligatorios',
      });
    }
    // El acceso a la app es opcional (uso local): si se provee uno de los dos,
    // se exige el otro; si no se provee ninguno, el cliente queda sin cuenta.
    if (Boolean(email) !== Boolean(password)) {
      return res.status(400).json({
        error: 'Si se provee email, password también es obligatorio (y viceversa)',
      });
    }

    const cliente = await clientesService.crearCliente(req.body, req.usuario.id);
    res.status(201).json(clienteDTO(cliente));
  } catch (error) {
    next(error);
  }
}

async function generarAcceso(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email y password son obligatorios' });
    }

    const resultado = await clientesService.generarAccesoCliente(req.params.id, { email, password }, req.usuario.id);
    if (resultado.error === 'CLIENTE_NO_ENCONTRADO') {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    if (resultado.error === 'CLIENTE_YA_TIENE_ACCESO') {
      return res.status(409).json({ error: 'El cliente ya tiene una cuenta de acceso' });
    }

    res.json(clienteDTO(resultado.cliente));
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

module.exports = { listar, obtener, crear, actualizar, desactivar, generarAcceso };
