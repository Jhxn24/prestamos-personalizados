const bcrypt = require('bcrypt');
const prisma = require('../../config/prisma');
const auditoriaService = require('../auditoria/auditoria.service');

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

async function crearCliente({ nombre, apellido, documento, telefono, direccion, email, password }, usuarioId) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const cliente = await prisma.cliente.create({
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

  await auditoriaService.registrar({
    usuarioId,
    entidad: 'CLIENTE',
    entidadId: cliente.id,
    accion: 'CREAR',
    detalle: `Cliente registrado: ${nombre} ${apellido} (doc. ${documento}).`,
  });

  return cliente;
}

/** RNF-12: registra en la bitácora qué campos cambiaron, no solo que hubo un cambio. */
function describirCambios(anterior, cambios) {
  const campos = ['nombre', 'apellido', 'documento', 'telefono', 'direccion'];
  const diferencias = campos
    .filter((campo) => cambios[campo] !== undefined && cambios[campo] !== anterior[campo])
    .map((campo) => `${campo}: "${anterior[campo] ?? ''}" -> "${cambios[campo]}"`);

  return diferencias.length > 0 ? diferencias.join(', ') : 'sin cambios en los campos';
}

async function actualizarCliente(id, datos, usuarioId) {
  const { nombre, apellido, documento, telefono, direccion } = datos;
  const anterior = await prisma.cliente.findUnique({ where: { id } });

  const actualizado = await prisma.cliente.update({
    where: { id },
    data: { nombre, apellido, documento, telefono, direccion },
    include: { usuario: usuarioPublico },
  });

  if (anterior) {
    await auditoriaService.registrar({
      usuarioId,
      entidad: 'CLIENTE',
      entidadId: id,
      accion: 'ACTUALIZAR',
      detalle: describirCambios(anterior, { nombre, apellido, documento, telefono, direccion }),
    });
  }

  return actualizado;
}

async function desactivarCliente(id, usuarioId) {
  const cliente = await prisma.cliente.update({
    where: { id },
    data: {
      activo: false,
      usuario: { update: { activo: false } },
    },
    include: { usuario: usuarioPublico },
  });

  await auditoriaService.registrar({
    usuarioId,
    entidad: 'CLIENTE',
    entidadId: id,
    accion: 'DESACTIVAR',
    detalle: `Cliente ${cliente.nombre} ${cliente.apellido} desactivado.`,
  });

  return cliente;
}

module.exports = {
  listarClientes,
  obtenerClientePorId,
  crearCliente,
  actualizarCliente,
  desactivarCliente,
};
