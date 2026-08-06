import { apiFetch } from "./api";
import type { CambiarPasswordInput } from "./types";

export function cambiarPassword(token: string, datos: CambiarPasswordInput) {
  return apiFetch<void>("/api/auth/cambiar-password", { token, method: "POST", body: JSON.stringify(datos) });
}
