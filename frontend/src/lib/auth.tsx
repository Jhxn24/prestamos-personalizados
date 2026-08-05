"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "./api";
import type { LoginResponse, Usuario } from "./types";

const STORAGE_KEY = "prestamos.auth";

interface SesionAlmacenada {
  token: string;
  usuario: Usuario;
}

interface AuthContextValue {
  token: string | null;
  usuario: Usuario | null;
  /** true mientras se lee la sesión guardada en localStorage al montar. */
  cargando: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Bootstrap: solo funciona una vez, mientras no exista ningún usuario todavía. */
  registrarAdmin: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * El backend solo emite JWT vía `Authorization: Bearer` (sin cookies
 * httpOnly), así que la sesión vive en localStorage y este provider la
 * expone al resto de la app.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    function restaurarSesion() {
      const guardado = window.localStorage.getItem(STORAGE_KEY);
      if (guardado) {
        try {
          const sesion: SesionAlmacenada = JSON.parse(guardado);
          setToken(sesion.token);
          setUsuario(sesion.usuario);
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
      setCargando(false);
    }
    restaurarSesion();
  }, []);

  async function login(email: string, password: string) {
    const respuesta = await apiFetch<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(respuesta));
    setToken(respuesta.token);
    setUsuario(respuesta.usuario);
  }

  async function registrarAdmin(email: string, password: string) {
    const respuesta = await apiFetch<LoginResponse>("/api/auth/registrar-admin", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(respuesta));
    setToken(respuesta.token);
    setUsuario(respuesta.usuario);
  }

  function logout() {
    window.localStorage.removeItem(STORAGE_KEY);
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
