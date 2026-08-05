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
  // El acceso a la app es opcional (uso local): solo se crea la cuenta si el
  // administrador proveyó credenciales; si no, el cliente queda sin usuarioId
  // y se le puede generar acceso después con `generarAccesoCliente`.
  const datosUsuario = email && password
    ? { usuario: { create: { email, password: await bcrypt.hash(password, SALT_ROUNDS), rol: 'CLIENTE' } } }
    : {};

  const cliente = await prisma.cliente.create({
    data: {
      nombre,
      apellido,
      documento,
      telefono,
      direccion,
      ...datosUsuario,
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

/** Agrega una cuenta de acceso a un cliente que no tenía (RF-04 opcional). */
async function generarAccesoCliente(id, { email, password }, usuarioId) {
  const cliente = await prisma.cliente.findUnique({ where: { id } });
  if (!cliente) {
    return { error: 'CLIENTE_NO_ENCONTRADO' };
  }
  if (cliente.usuarioId) {
    return { error: 'CLIENTE_YA_TIENE_ACCESO' };
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const actualizado = await prisma.cliente.update({
    where: { id },
    data: { usuario: { create: { email, password: passwordHash, rol: 'CLIENTE' } } },
    include: { usuario: usuarioPublico },
  });

  await auditoriaService.registrar({
    usuarioId,
    entidad: 'CLIENTE',
    entidadId: id,
    accion: 'ACTUALIZAR',
    detalle: `Se generó acceso a la app para ${actualizado.nombre} ${actualizado.apellido}.`,
  });

  return { cliente: actualizado };
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
  const existente = await prisma.cliente.findUnique({ where: { id }, select: { usuarioId: true } });

  const cliente = await prisma.cliente.update({
    where: { id },
    data: {
      activo: false,
      // Un cliente sin cuenta (acceso opcional) no tiene usuario que desactivar.
      ...(existente?.usuarioId ? { usuario: { update: { activo: false } } } : {}),
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
  generarAccesoCliente,
  actualizarCliente,
  desactivarCliente,
};
