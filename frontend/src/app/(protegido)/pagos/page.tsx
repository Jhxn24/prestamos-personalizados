"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { listarPagos } from "@/lib/pagos-api";
import type { EstadoPago, Pago } from "@/lib/types";
import { DataTable } from "@/components/ui/data-table";
import { crearColumnasPagos } from "@/components/pagos/columns";
import { VerDesglosePagoDialog } from "@/components/pagos/ver-desglose-pago-dialog";
import { ConfirmarPagoDialog } from "@/components/pagos/confirmar-pago-dialog";
import { RechazarPagoDialog } from "@/components/pagos/rechazar-pago-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OPCIONES_ESTADO: { value: string; label: string }[] = [
  { value: "TODOS", label: "Todos" },
  { value: "PENDIENTE_CONFIRMACION", label: "Pendiente de confirmación" },
  { value: "CONFIRMADO", label: "Confirmado" },
  { value: "RECHAZADO", label: "Rechazado" },
];

export default function PagosPage() {
  const { token, usuario } = useAuth();
  const esAdministrador = usuario?.rol === "ADMINISTRADOR";

  const [pagos, setPagos] = useState<Pago[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("TODOS");

  const [pagoDesglose, setPagoDesglose] = useState<Pago | null>(null);
  const [pagoConfirmar, setPagoConfirmar] = useState<Pago | null>(null);
  const [pagoRechazar, setPagoRechazar] = useState<Pago | null>(null);

  useEffect(() => {
    if (!token) return;
    let activo = true;

    async function cargarPagos() {
      setCargando(true);
      try {
        const respuesta = await listarPagos(token!, {
          estado: filtroEstado === "TODOS" ? undefined : (filtroEstado as EstadoPago),
        });
        if (activo) setPagos(respuesta);
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : "No se pudo cargar la lista de pagos");
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargarPagos();

    return () => {
      activo = false;
    };
  }, [token, filtroEstado]);

  function alActualizar(pago: Pago) {
    setPagos((actual) => actual?.map((item) => (item.id === pago.id ? pago : item)) ?? null);
  }

  const columnas = crearColumnasPagos({
    esAdministrador,
    onVerDesglose: setPagoDesglose,
    onConfirmar: setPagoConfirmar,
    onRechazar: setPagoRechazar,
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Pagos</h1>

      <div className="flex max-w-xs flex-col gap-2">
        <Label>Estado</Label>
        <Select items={OPCIONES_ESTADO} value={filtroEstado} onValueChange={(valor) => setFiltroEstado(valor ?? "TODOS")}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPCIONES_ESTADO.map((opcion) => (
              <SelectItem key={opcion.value} value={opcion.value}>
                {opcion.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {cargando || !pagos ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, indice) => (
            <Skeleton key={indice} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <DataTable columns={columnas} data={pagos} searchPlaceholder="Buscar..." />
      )}

      <VerDesglosePagoDialog
        open={!!pagoDesglose}
        onOpenChange={(open) => !open && setPagoDesglose(null)}
        pago={pagoDesglose}
      />
      <ConfirmarPagoDialog
        open={!!pagoConfirmar}
        onOpenChange={(open) => !open && setPagoConfirmar(null)}
        pago={pagoConfirmar}
        onSuccess={alActualizar}
      />
      <RechazarPagoDialog
        open={!!pagoRechazar}
        onOpenChange={(open) => !open && setPagoRechazar(null)}
        pago={pagoRechazar}
        onSuccess={alActualizar}
      />
    </div>
  );
}
