import { apiFetch } from "./api";
import type { AccionAuditoria, EntidadAuditoria, RegistroAuditoria } from "./types";

export interface FiltrosAuditoria {
  entidad?: EntidadAuditoria;
  entidadId?: string;
  usuarioId?: string;
  desde?: string;
  hasta?: string;
}

export function listarAuditoria(token: string, filtros: FiltrosAuditoria = {}) {
  const query = new URLSearchParams(
    Object.entries(filtros).filter(([, valor]) => Boolean(valor)) as [string, string][]
  ).toString();

  return apiFetch<RegistroAuditoria[]>(`/api/auditoria${query ? `?${query}` : ""}`, { token });
}

export const ETIQUETAS_ACCION: Record<AccionAuditoria, string> = {
  CREAR: "Creado",
  ACTUALIZAR: "Actualizado",
  DESACTIVAR: "Desactivado",
  RECALCULAR: "Recalculado",
  REFINANCIAR: "Refinanciado",
  CONFIRMAR: "Confirmado",
  RECHAZAR: "Rechazado",
};

export const ETIQUETAS_ENTIDAD: Record<EntidadAuditoria, string> = {
  CLIENTE: "Cliente",
  PRESTAMO: "Préstamo",
  PAGO: "Pago",
};
