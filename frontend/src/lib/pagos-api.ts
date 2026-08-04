import { apiFetch } from "./api";
import type { ConfirmarPagoInput, EstadoPago, Pago, RegistrarPagoInput } from "./types";

interface FiltrosPagos {
  estado?: EstadoPago;
  prestamoId?: string;
}

export function listarPagos(token: string, filtros: FiltrosPagos = {}) {
  const params = new URLSearchParams();
  if (filtros.estado) params.set("estado", filtros.estado);
  if (filtros.prestamoId) params.set("prestamoId", filtros.prestamoId);
  const query = params.toString();
  return apiFetch<Pago[]>(`/api/pagos${query ? `?${query}` : ""}`, { token });
}

export function obtenerPago(token: string, id: string) {
  return apiFetch<Pago>(`/api/pagos/${id}`, { token });
}

/**
 * Un solo endpoint para ambos roles (RF-21 cliente reporta, RF-25 admin
 * registra directo) — el backend decide el comportamiento según el rol del
 * token, no hace falta distinguir acá.
 */
export function registrarPago(token: string, datos: RegistrarPagoInput) {
  return apiFetch<Pago>("/api/pagos", {
    token,
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export function confirmarPago(token: string, id: string, datos: ConfirmarPagoInput = {}) {
  return apiFetch<Pago>(`/api/pagos/${id}/confirmar`, {
    token,
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export function rechazarPago(token: string, id: string, motivoRechazo?: string) {
  return apiFetch<Pago>(`/api/pagos/${id}/rechazar`, {
    token,
    method: "POST",
    body: JSON.stringify({ motivoRechazo }),
  });
}
