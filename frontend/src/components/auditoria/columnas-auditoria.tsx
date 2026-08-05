"use client";

import type { Column, ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { RegistroAuditoria } from "@/lib/types";
import { ETIQUETAS_ACCION, ETIQUETAS_ENTIDAD } from "@/lib/auditoria-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function EncabezadoOrdenable({
  column,
  children,
}: {
  column: Column<RegistroAuditoria, unknown>;
  children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {children}
      <ArrowUpDown className="ml-1.5 size-3.5" />
    </Button>
  );
}

function formatearFechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

const VARIANTE_ACCION: Record<RegistroAuditoria["accion"], "default" | "secondary" | "destructive"> = {
  CREAR: "default",
  ACTUALIZAR: "secondary",
  DESACTIVAR: "destructive",
  RECALCULAR: "secondary",
  REFINANCIAR: "secondary",
  CONFIRMAR: "default",
  RECHAZAR: "destructive",
  ANULAR: "destructive",
  PURGAR: "destructive",
};

/** Enlace al detalle de la entidad afectada, cuando existe una página para eso. */
function enlaceEntidad(registro: RegistroAuditoria): string | null {
  if (registro.entidad === "PRESTAMO") return `/prestamos/${registro.entidadId}`;
  if (registro.entidad === "CLIENTE") return `/clientes/${registro.entidadId}`;
  return null;
}

export const columnasAuditoria: ColumnDef<RegistroAuditoria>[] = [
  {
    accessorKey: "createdAt",
    header: ({ column }) => <EncabezadoOrdenable column={column}>Fecha</EncabezadoOrdenable>,
    cell: ({ row }) => formatearFechaHora(row.original.createdAt),
  },
  {
    id: "entidad",
    accessorFn: (registro) => ETIQUETAS_ENTIDAD[registro.entidad],
    header: ({ column }) => <EncabezadoOrdenable column={column}>Entidad</EncabezadoOrdenable>,
    cell: ({ row }) => {
      const enlace = enlaceEntidad(row.original);
      const etiqueta = ETIQUETAS_ENTIDAD[row.original.entidad];
      return enlace ? (
        <Link href={enlace} className="hover:underline">
          {etiqueta}
        </Link>
      ) : (
        etiqueta
      );
    },
  },
  {
    id: "accion",
    accessorFn: (registro) => ETIQUETAS_ACCION[registro.accion],
    header: ({ column }) => <EncabezadoOrdenable column={column}>Acción</EncabezadoOrdenable>,
    cell: ({ row }) => (
      <Badge variant={VARIANTE_ACCION[row.original.accion]}>{ETIQUETAS_ACCION[row.original.accion]}</Badge>
    ),
  },
  {
    id: "usuario",
    accessorFn: (registro) => registro.usuario.email,
    header: ({ column }) => <EncabezadoOrdenable column={column}>Usuario</EncabezadoOrdenable>,
  },
  {
    accessorKey: "detalle",
    header: "Detalle",
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.detalle ?? "—"}</span>,
  },
];
