"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const { token, usuario, cargando, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!cargando && !token) {
      router.replace("/login");
    }
  }, [cargando, token, router]);

  if (cargando || !token || !usuario) {
    // Evita mostrar contenido protegido mientras se resuelve la sesión o
    // durante el redirect a /login.
    return null;
  }

  return (
    <AppShell usuario={usuario} onLogout={logout}>
      {children}
    </AppShell>
  );
}
