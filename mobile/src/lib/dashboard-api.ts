import { apiFetch } from "./api";
import type { DashboardAdmin, DashboardCliente } from "./types";

/** Un solo endpoint; el rol del token decide la vista (RF-29 admin, RF-30 cliente). */
export function obtenerDashboard<T = DashboardAdmin | DashboardCliente>(token: string) {
  return apiFetch<T>("/api/dashboard", { token });
}
