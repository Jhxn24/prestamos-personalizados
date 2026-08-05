import { apiFetch } from "./api";
import type {
  ActualizarClienteInput,
  Cliente,
  CrearClienteInput,
  GenerarAccesoClienteInput,
} from "./types";

export function listarClientes(token: string) {
  return apiFetch<Cliente[]>("/api/clientes", { token });
}

export function obtenerCliente(token: string, id: string) {
  return apiFetch<Cliente>(`/api/clientes/${id}`, { token });
}

export function crearCliente(token: string, datos: CrearClienteInput) {
  return apiFetch<Cliente>("/api/clientes", {
    token,
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export function actualizarCliente(token: string, id: string, datos: ActualizarClienteInput) {
  return apiFetch<Cliente>(`/api/clientes/${id}`, {
    token,
    method: "PUT",
    body: JSON.stringify(datos),
  });
}

export function desactivarCliente(token: string, id: string) {
  return apiFetch<Cliente>(`/api/clientes/${id}/desactivar`, {
    token,
    method: "PATCH",
  });
}

export function generarAccesoCliente(token: string, id: string, datos: GenerarAccesoClienteInput) {
  return apiFetch<Cliente>(`/api/clientes/${id}/generar-acceso`, {
    token,
    method: "PATCH",
    body: JSON.stringify(datos),
  });
}
