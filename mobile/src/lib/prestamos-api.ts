import { apiFetch } from "./api";
import type { CrearPrestamoInput, Prestamo, SimularPrestamoInput, SimularPrestamoResponse } from "./types";

/** Cliente ve solo los suyos (RNF-05); el admin los ve todos. */
export function listarPrestamos(token: string) {
  return apiFetch<Prestamo[]>("/api/prestamos", { token });
}

export function obtenerPrestamo(token: string, id: string) {
  return apiFetch<Prestamo>(`/api/prestamos/${id}`, { token });
}

/** No persiste nada: solo calcula el cronograma para previsualizar (RF-09). */
export function simularPrestamo(token: string, datos: SimularPrestamoInput) {
  return apiFetch<SimularPrestamoResponse>("/api/prestamos/simular", {
    token,
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export function crearPrestamo(token: string, datos: CrearPrestamoInput) {
  return apiFetch<Prestamo>("/api/prestamos", { token, method: "POST", body: JSON.stringify(datos) });
}

/**
 * RF-09: reemplaza el cronograma pendiente. Solo válido sobre un préstamo
 * ACTIVO sin pagos aplicados — el backend rechaza el resto con un mensaje
 * claro (ApiError.message ya trae el motivo).
 */
export function recalcularPrestamo(token: string, id: string, ajustes: SimularPrestamoInput) {
  return apiFetch<Prestamo>(`/api/prestamos/${id}/recalcular`, {
    token,
    method: "POST",
    body: JSON.stringify(ajustes),
  });
}

/** RF-08: cierra el préstamo actual (queda REFINANCIADO) y devuelve uno nuevo por el saldo pendiente. */
export function refinanciarPrestamo(token: string, id: string, condiciones: SimularPrestamoInput) {
  return apiFetch<Prestamo>(`/api/prestamos/${id}/refinanciar`, {
    token,
    method: "POST",
    body: JSON.stringify(condiciones),
  });
}

/** RF-16: recalcula atraso y mora a la fecha. Idempotente. */
export function actualizarMora(token: string, id: string) {
  return apiFetch<Prestamo>(`/api/prestamos/${id}/actualizar-mora`, { token, method: "POST" });
}
