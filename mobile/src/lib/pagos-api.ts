import { apiFetch } from "./api";
import type { AnularPagoInput, EstadoPago, Pago, RegistrarPagoInput } from "./types";

export function listarPagos(token: string, filtros: { estado?: EstadoPago; prestamoId?: string } = {}) {
  const query = new URLSearchParams(
    Object.entries(filtros).filter(([, valor]) => Boolean(valor)) as [string, string][]
  ).toString();
  return apiFetch<Pago[]>(`/api/pagos${query ? `?${query}` : ""}`, { token });
}

/** RF-25 — solo el administrador registra pagos; se aplican de inmediato. */
export function registrarPago(token: string, datos: RegistrarPagoInput) {
  return apiFetch<Pago>("/api/pagos", { token, method: "POST", body: JSON.stringify(datos) });
}

/** Anula un pago marcado por error, revirtiendo su efecto en el préstamo. */
export function anularPago(token: string, pagoId: string, datos: AnularPagoInput = {}) {
  return apiFetch<Pago>(`/api/pagos/${pagoId}/anular`, {
    token,
    method: "POST",
    body: JSON.stringify(datos),
  });
}
