import { apiFetch } from "./api";
import type { EstadoPago, Pago, RegistrarPagoInput } from "./types";

export function listarPagos(token: string, filtros: { estado?: EstadoPago; prestamoId?: string } = {}) {
  const query = new URLSearchParams(
    Object.entries(filtros).filter(([, valor]) => Boolean(valor)) as [string, string][]
  ).toString();
  return apiFetch<Pago[]>(`/api/pagos${query ? `?${query}` : ""}`, { token });
}

/** RF-21 (cliente reporta) o RF-25 (admin registra directo) — el backend decide por el rol. */
export function registrarPago(token: string, datos: RegistrarPagoInput) {
  return apiFetch<Pago>("/api/pagos", { token, method: "POST", body: JSON.stringify(datos) });
}

/** RF-23 — administrador. Se resuelve con las políticas por defecto (COMPLETO / REDUCIR_CUOTA). */
export function confirmarPago(token: string, pagoId: string) {
  return apiFetch<Pago>(`/api/pagos/${pagoId}/confirmar`, { token, method: "POST" });
}

/** RF-23 — administrador. */
export function rechazarPago(token: string, pagoId: string, motivoRechazo?: string) {
  return apiFetch<Pago>(`/api/pagos/${pagoId}/rechazar`, {
    token,
    method: "POST",
    body: JSON.stringify({ motivoRechazo }),
  });
}
