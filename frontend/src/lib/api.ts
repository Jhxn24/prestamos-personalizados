const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface ApiFetchOptions extends Omit<RequestInit, "headers"> {
  token?: string | null;
  headers?: Record<string, string>;
}

/**
 * Wrapper de fetch contra el backend: arma la URL, adjunta el Bearer token si
 * hay uno, y traduce `{ error: "..." }` (el shape que usa errorHandler.js en
 * el backend) a una ApiError con el mensaje real en vez de un 4xx/5xx genérico.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { token, headers, ...rest } = options;

  const respuesta = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!respuesta.ok) {
    let mensaje = `Error ${respuesta.status}`;
    try {
      const cuerpo = await respuesta.json();
      if (cuerpo?.error) mensaje = cuerpo.error;
    } catch {
      // Sin cuerpo JSON: se deja el mensaje genérico.
    }
    throw new ApiError(respuesta.status, mensaje);
  }

  if (respuesta.status === 204) {
    return undefined as T;
  }

  return (await respuesta.json()) as T;
}
