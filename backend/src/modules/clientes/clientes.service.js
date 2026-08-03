const bcrypt = require('bcrypt');
const prisma = require('../../config/prisma');

const SALT_ROUNDS = 10;

const usuarioPublico = {
  select: { id: true, email: true, rol: true, activo: true },
};

function listarClientes() {
  return prisma.cliente.findMany({
    include: { usuario: usuarioPublico },
    orderBy: { createdAt: 'desc' },
  });
}

function obtenerClientePorId(id) {
  return prisma.cliente.findUnique({
    where: { id },
    include: { usuario: usuarioPublico },
  });
}

async function crearCliente({ nombre, apellido, documento, telefono, direccion, email, password }) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  return prisma.cliente.create({
    data: {
      nombre,
      apellido,
      documento,
      telefono,
      direccion,
      usuario: {
        create: {
          email,
          password: passwordHash,
          rol: 'CLIENTE',
        },
      },
    },
    include: { usuario: usuarioPublico },
  });
}

function actualizarCliente(id, { nombre, apellido, documento, telefono, direccion }) {
  return prisma.cliente.update({
    where: { id },
    data: { nombre, apellido, documento, telefono, direccion },
    include: { usuario: usuarioPublico },
  });
}

function desactivarCliente(id) {
  return prisma.cliente.update({
    where: { id },
    data: {
      activo: false,
      usuario: { update: { activo: false } },
    },
    include: { usuario: usuarioPublico },
  });
}

module.exports = {
  listarClientes,
  obtenerClientePorId,
  crearCliente,
  actualizarCliente,
  desactivarCliente,
};
