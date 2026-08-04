"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { apiFetch, ApiError } from "@/lib/api";
import type { DashboardAdmin, DashboardCliente } from "@/lib/types";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { ClienteDashboard } from "@/components/dashboard/cliente-dashboard";
import { Skeleton } from "@/components/ui/skeleton";

type DashboardData = DashboardAdmin | DashboardCliente;

export default function DashboardPage() {
  const { token, usuario } = useAuth();
  const [datos, setDatos] = useState<DashboardData | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!token) return;
    let activo = true;

    async function cargarDashboard() {
      setCargando(true);
      try {
        const respuesta = await apiFetch<DashboardData>("/api/dashboard", { token });
        if (activo) setDatos(respuesta);
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : "No se pudo cargar el dashboard");
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargarDashboard();

    return () => {
      activo = false;
    };
  }, [token]);

  if (cargando || !datos) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, indice) => (
          <Skeleton key={indice} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  if (usuario?.rol === "ADMINISTRADOR") {
    return <AdminDashboard datos={datos as DashboardAdmin} />;
  }

  return <ClienteDashboard prestamos={datos as DashboardCliente} />;
}
