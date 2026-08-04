"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { apiFetch, ApiError } from "@/lib/api";
import { listarPagos } from "@/lib/pagos-api";
import type { DashboardAdmin, DashboardCliente, Pago } from "@/lib/types";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { ClienteDashboard } from "@/components/dashboard/cliente-dashboard";
import { Skeleton } from "@/components/ui/skeleton";

type DashboardData = DashboardAdmin | DashboardCliente;

export default function DashboardPage() {
  const { token, usuario } = useAuth();
  const [datos, setDatos] = useState<DashboardData | null>(null);
  const [pagosPendientes, setPagosPendientes] = useState<Pago[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!token || !usuario) return;
    let activo = true;

    async function cargarDashboard() {
      setCargando(true);
      try {
        const esAdministrador = usuario!.rol === "ADMINISTRADOR";
        // RF-28: solo el admin necesita los pagos pendientes de confirmar; se
        // trae con una segunda llamada al módulo de pagos ya existente en vez
        // de inflar /api/dashboard con un campo que solo un rol usa.
        const [respuesta, pendientes] = await Promise.all([
          apiFetch<DashboardData>("/api/dashboard", { token: token! }),
          esAdministrador
            ? listarPagos(token!, { estado: "PENDIENTE_CONFIRMACION" })
            : Promise.resolve<Pago[]>([]),
        ]);
        if (!activo) return;
        setDatos(respuesta);
        setPagosPendientes(pendientes);
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
  }, [token, usuario]);

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
    return <AdminDashboard datos={datos as DashboardAdmin} pagosPendientes={pagosPendientes} />;
  }

  return <ClienteDashboard prestamos={datos as DashboardCliente} />;
}
