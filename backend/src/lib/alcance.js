const prisma = require('../config/prisma');

/**
 * Resuelve el alcance de datos del usuario autenticado: un administrador ve
 * su propia cartera (administradorId = su propio id); un cliente ve solo su
 * préstamo (clienteId), heredando el administradorId de su cliente para los
 * casos que lo necesiten.
 */
async function resolverAlcance(usuario) {
  if (usuario.rol === 'ADMINISTRADOR') {
    return { administradorId: usuario.id, clienteId: null };
  }

  const cliente = await prisma.cliente.findUnique({ where: { usuarioId: usuario.id } });
  return {
    administradorId: cliente?.administradorId ?? null,
    clienteId: cliente?.id ?? 'sin-cliente-asociado',
  };
}

module.exports = { resolverAlcance };
