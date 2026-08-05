import { apiFetch } from "./api";
import type { CambiarPasswordInput } from "./types";

/** El login usa esto para decidir si muestra "Crear cuenta de administrador" en vez del formulario normal. */
export function verificarSetupRequerido() {
  return apiFetch<{ requerido: boolean }>("/api/auth/setup-requerido");
}

export function cambiarPassword(token: string, datos: CambiarPasswordInput) {
  return apiFetch<void>("/api/auth/cambiar-password", { token, method: "POST", body: JSON.stringify(datos) });
}
