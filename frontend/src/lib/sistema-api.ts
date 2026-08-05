import { apiFetch } from "./api";
import type { PurgarDatosInput, PurgarDatosResultado } from "./types";

/** Borra TODOS los clientes, préstamos, cuotas, pagos y cuentas de cliente. Irreversible. */
export function purgarDatos(token: string, datos: PurgarDatosInput) {
  return apiFetch<PurgarDatosResultado>("/api/sistema/purgar-datos", {
    token,
    method: "POST",
    body: JSON.stringify(datos),
  });
}
