import { apiFetch } from "./api";
import type { AnularPagoInput, EstadoPago, Pago, RegistrarPagoInput } from "./types";

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

/** Solo el administrador registra pagos (RF-25); se aplican de inmediato. */
export function registrarPago(token: string, datos: RegistrarPagoInput) {
  return apiFetch<Pago>("/api/pagos", {
    token,
    method: "POST",
    body: JSON.stringify(datos),
  });
}

/** Anula un pago marcado por error, revirtiendo su efecto en el préstamo. */
export function anularPago(token: string, id: string, datos: AnularPagoInput = {}) {
  return apiFetch<Pago>(`/api/pagos/${id}/anular`, {
    token,
    method: "POST",
    body: JSON.stringify(datos),
  });
}
