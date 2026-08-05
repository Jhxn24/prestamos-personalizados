/**
 * Shape público de un cliente: aplana el email desde la cuenta de usuario
 * asociada y deja fuera usuarioId, rol (siempre CLIENTE) y createdAt/updatedAt.
 */
function clienteDTO(cliente) {
  return {
    id: cliente.id,
    nombre: cliente.nombre,
    apellido: cliente.apellido,
    documento: cliente.documento,
    telefono: cliente.telefono,
    direccion: cliente.direccion,
    activo: cliente.activo,
    email: cliente.usuario?.email ?? null,
    tieneAcceso: Boolean(cliente.usuarioId),
  };
}

module.exports = { clienteDTO };
