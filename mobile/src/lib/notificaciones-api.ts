import { apiFetch } from "./api";
import type { Notificacion } from "./types";

export function listarNotificaciones(token: string, opciones: { soloNoLeidas?: boolean } = {}) {
  const query = opciones.soloNoLeidas ? "?noLeidas=true" : "";
  return apiFetch<Notificacion[]>(`/api/notificaciones${query}`, { token });
}

export function contarNotificacionesNoLeidas(token: string) {
  return apiFetch<{ noLeidas: number }>("/api/notificaciones/no-leidas/contador", { token });
}

export function marcarNotificacionLeida(token: string, id: string) {
  return apiFetch<void>(`/api/notificaciones/${id}/leer`, { token, method: "POST" });
}

export function marcarTodasLasNotificacionesLeidas(token: string) {
  return apiFetch<void>("/api/notificaciones/leer-todas", { token, method: "POST" });
}
