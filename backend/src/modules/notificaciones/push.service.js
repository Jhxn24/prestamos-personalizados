const prisma = require('../../config/prisma');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Envía un push de verdad (Expo Push API) a todos los dispositivos
 * registrados de un usuario, además del aviso que ya quedó guardado en la
 * tabla Notificacion. Es best-effort a propósito: si Expo está caído o el
 * token quedó inválido, no debe romper la operación de negocio que lo
 * disparó (registrar un pago, por ejemplo) — nunca lanza.
 */
async function enviarPush(usuarioId, { titulo, mensaje, data }) {
  const tokens = await prisma.pushToken.findMany({
    where: { usuarioId },
    select: { id: true, token: true },
  });
  if (tokens.length === 0) return;

  const mensajes = tokens.map((t) => ({
    to: t.token,
    title: titulo,
    body: mensaje,
    data: data ?? {},
    sound: 'default',
  }));

  let respuesta;
  try {
    respuesta = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(mensajes),
    });
  } catch {
    return;
  }

  if (!respuesta.ok) return;

  let cuerpo;
  try {
    cuerpo = await respuesta.json();
  } catch {
    return;
  }

  // Un token deja de existir si el usuario desinstaló la app o cambió de
  // celular — Expo lo marca así en vez de simplemente fallar, así que se
  // aprovecha para no seguir intentando mandarle nada.
  const tokensInvalidos = (cuerpo?.data ?? [])
    .map((ticket, indice) => (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' ? tokens[indice]?.id : null))
    .filter(Boolean);

  if (tokensInvalidos.length > 0) {
    await prisma.pushToken.deleteMany({ where: { id: { in: tokensInvalidos } } });
  }
}

module.exports = { enviarPush };
