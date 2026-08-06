import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "./api";
import { registrarPushToken } from "./push-notifications";
import * as SecureStorage from "./secure-storage";
import type { LoginResponse, Usuario } from "./types";

const STORAGE_KEY = "prestamos.auth";

interface SesionAlmacenada {
  token: string;
  usuario: Usuario;
}

interface AuthContextValue {
  token: string | null;
  usuario: Usuario | null;
  /** true mientras se lee la sesión guardada en SecureStore al montar. */
  cargando: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Multi-tenant: registro siempre abierto, crea un administrador con cartera propia. */
  registrarAdmin: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * El backend solo emite JWT vía `Authorization: Bearer` (sin cookies), así
 * que la sesión vive en almacenamiento local (SecureStore en nativo,
 * localStorage en web — ver ./secure-storage.ts) y este provider la expone
 * al resto de la app. Mismo contrato que frontend/src/lib/auth.tsx.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function restaurarSesion() {
      const guardado = await SecureStorage.getItem(STORAGE_KEY);
      if (guardado) {
        try {
          const sesion: SesionAlmacenada = JSON.parse(guardado);
          setToken(sesion.token);
          setUsuario(sesion.usuario);
        } catch {
          await SecureStorage.deleteItem(STORAGE_KEY);
        }
      }
      setCargando(false);
    }
    restaurarSesion();
  }, []);

  // Registra el token de push apenas hay sesión (login fresco o restaurada),
  // no solo en `login`: si no, un usuario que ya estaba logueado al abrir la
  // app nunca quedaría suscrito a push.
  useEffect(() => {
    if (token) {
      registrarPushToken(token);
    }
  }, [token]);

  async function login(email: string, password: string) {
    const respuesta = await apiFetch<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await SecureStorage.setItem(STORAGE_KEY, JSON.stringify(respuesta));
    setToken(respuesta.token);
    setUsuario(respuesta.usuario);
  }

  async function registrarAdmin(email: string, password: string) {
    const respuesta = await apiFetch<LoginResponse>("/api/auth/registrar-admin", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await SecureStorage.setItem(STORAGE_KEY, JSON.stringify(respuesta));
    setToken(respuesta.token);
    setUsuario(respuesta.usuario);
  }

  function logout() {
    SecureStorage.deleteItem(STORAGE_KEY);
    setToken(null);
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ token, usuario, cargando, login, registrarAdmin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  }
  return contexto;
}
