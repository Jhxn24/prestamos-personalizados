import { apiFetch } from "./api";
import type { CrearPrestamoInput, Prestamo, SimularPrestamoInput, SimularPrestamoResponse } from "./types";

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
  return apiFetch<Prestamo>("/api/prestamos", {
    token,
    method: "POST",
    body: JSON.stringify(datos),
  });
}
