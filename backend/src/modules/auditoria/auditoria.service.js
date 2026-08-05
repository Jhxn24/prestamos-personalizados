const prisma = require('../../config/prisma');

/**
 * RF-36/RNF-12: deja constancia de un cambio relevante (usuario, fecha y hora).
 *
 * Si no hay `usuarioId` (por ejemplo, una llamada de test que no pasa un
 * usuario autenticado) no se registra nada: la bitácora es un efecto
 * secundario de auditoría, no debe romper la operación que audita.
 */
function registrar({ usuarioId, entidad, entidadId, accion, detalle }) {
  if (!usuarioId) return null;

  return prisma.registroAuditoria.create({
    data: { usuarioId, entidad, entidadId, accion, detalle: detalle ?? null },
  });
}

function listar({ entidad, entidadId, usuarioId, desde, hasta } = {}) {
  return prisma.registroAuditoria.findMany({
    where: {
      entidad: entidad || undefined,
      entidadId: entidadId || undefined,
      usuarioId: usuarioId || undefined,
      createdAt: desde || hasta ? { gte: desde || undefined, lte: hasta || undefined } : undefined,
    },
    include: { usuario: { select: { email: true, rol: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

module.exports = { registrar, listar };
