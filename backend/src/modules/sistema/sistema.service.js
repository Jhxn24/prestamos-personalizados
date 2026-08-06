const bcrypt = require('bcrypt');
const prisma = require('../../config/prisma');

/**
 * Frase que el administrador debe escribir tal cual para confirmar el
 * borrado. Es una segunda barrera además de la contraseña: evita que un
 * clic accidental en la UI dispare la acción más destructiva del sistema.
 */
const FRASE_CONFIRMACION = 'ELIMINAR TODO';

/**
 * Borra TODOS los clientes, préstamos, cuotas, pagos, recibos y cuentas de
 * cliente del sistema. Es intencionalmente irreversible: no hay papelera ni
 * "deshacer". La bitácora de auditoría (incluida esta misma acción) es lo
 * único que sobrevive, para que quede constancia de quién lo hizo y cuándo.
 *
 * Dos confirmaciones antes de ejecutar: la frase exacta (protege contra un
 * clic accidental) y la contraseña del propio administrador (protege contra
 * una sesión dejada abierta).
 */
async function purgarDatos(usuarioId, { confirmacion, password }) {
  if (confirmacion !== FRASE_CONFIRMACION) {
    return { error: 'CONFIRMACION_INVALIDA' };
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) {
    return { error: 'USUARIO_NO_ENCONTRADO' };
  }

  const passwordValida = await bcrypt.compare(password ?? '', usuario.password);
  if (!passwordValida) {
    return { error: 'PASSWORD_INVALIDA' };
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const filtroCartera = { cliente: { administradorId: usuarioId } };

    const [clientes, prestamos, pagos] = await Promise.all([
      tx.cliente.count({ where: { administradorId: usuarioId } }),
      tx.prestamo.count({ where: filtroCartera }),
      tx.pago.count({ where: { prestamo: filtroCartera } }),
    ]);

    // Las cuentas de acceso de cliente hay que identificarlas ANTES de borrar
    // Cliente: una vez borrado, la relación para encontrarlas ya no existe.
    const clientesConAcceso = await tx.cliente.findMany({
      where: { administradorId: usuarioId, usuarioId: { not: null } },
      select: { usuarioId: true },
    });

    // Rompe primero el auto-referencia de refinanciamiento (aunque el FK ya
    // es ON DELETE SET NULL, hacerlo explícito evita cualquier ambigüedad de
    // orden al borrar toda la tabla en un solo statement.
    await tx.prestamo.updateMany({ where: filtroCartera, data: { prestamoOrigenId: null } });

    // Cuota, Pago, Recibo y PagoSnapshot cuelgan de Prestamo con ON DELETE
    // CASCADE — desaparecen solos.
    await tx.prestamo.deleteMany({ where: filtroCartera });
    await tx.cliente.deleteMany({ where: { administradorId: usuarioId } });

    // Las cuentas de acceso de cliente quedan huérfanas al borrar Cliente (esa
    // relación no tiene cascada en ese sentido); sus notificaciones sí caen en
    // cascada al borrar el Usuario. Solo se borran las de ESTE administrador.
    const { count: cuentasClienteEliminadas } = await tx.usuario.deleteMany({
      where: { id: { in: clientesConAcceso.map((c) => c.usuarioId) } },
    });

    await tx.registroAuditoria.create({
      data: {
        usuarioId,
        entidad: 'SISTEMA',
        entidadId: usuarioId,
        accion: 'PURGAR',
        detalle: `Se eliminaron todos los datos de la cartera: ${clientes} clientes, ${prestamos} préstamos, ${pagos} pagos y ${cuentasClienteEliminadas} cuentas de cliente.`,
      },
    });

    return { clientes, prestamos, pagos, cuentasCliente: cuentasClienteEliminadas };
  });

  return { resultado };
}

module.exports = { purgarDatos, FRASE_CONFIRMACION };
