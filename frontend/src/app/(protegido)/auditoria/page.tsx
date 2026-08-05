"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { listarAuditoria } from "@/lib/auditoria-api";
import type { EntidadAuditoria, RegistroAuditoria } from "@/lib/types";
import { DataTable } from "@/components/ui/data-table";
import { columnasAuditoria } from "@/components/auditoria/columnas-auditoria";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OPCIONES_ENTIDAD: { value: string; label: string }[] = [
  { value: "TODAS", label: "Todas" },
  { value: "CLIENTE", label: "Cliente" },
  { value: "PRESTAMO", label: "Préstamo" },
  { value: "PAGO", label: "Pago" },
];

export default function AuditoriaPage() {
  const { token, usuario } = useAuth();
  const router = useRouter();

  const [registros, setRegistros] = useState<RegistroAuditoria[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [filtroEntidad, setFiltroEntidad] = useState("TODAS");

  useEffect(() => {
    if (usuario && usuario.rol !== "ADMINISTRADOR") {
      router.replace("/dashboard");
    }
  }, [usuario, router]);

  useEffect(() => {
    if (!token || usuario?.rol !== "ADMINISTRADOR") return;
    let activo = true;

    async function cargarRegistros() {
      setCargando(true);
      try {
        const respuesta = await listarAuditoria(token!, {
          entidad: filtroEntidad === "TODAS" ? undefined : (filtroEntidad as EntidadAuditoria),
        });
        if (activo) setRegistros(respuesta);
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : "No se pudo cargar la bitácora de auditoría");
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargarRegistros();

    return () => {
      activo = false;
    };
  }, [token, usuario, filtroEntidad]);

  if (usuario && usuario.rol !== "ADMINISTRADOR") {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Auditoría</h1>
        <p className="text-sm text-muted-foreground">
          Bitácora de cambios relevantes: quién hizo qué, cuándo y sobre qué registro.
        </p>
      </div>

      <div className="flex max-w-xs flex-col gap-2">
        <Label>Entidad</Label>
        <Select
          items={OPCIONES_ENTIDAD}
          value={filtroEntidad}
          onValueChange={(valor) => setFiltroEntidad(valor ?? "TODAS")}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPCIONES_ENTIDAD.map((opcion) => (
              <SelectItem key={opcion.value} value={opcion.value}>
                {opcion.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {cargando || !registros ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, indice) => (
            <Skeleton key={indice} className="h-10 w-full" />
          ))}
        </div>
      ) : registros.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay registros de auditoría.</p>
      ) : (
        <DataTable columns={columnasAuditoria} data={registros} searchPlaceholder="Buscar por usuario o detalle..." />
      )}
    </div>
  );
}
