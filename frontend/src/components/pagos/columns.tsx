"use client";

import type { Column, ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Pago } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ColumnasPagosOpciones {
  esAdministrador: boolean;
  onVerDesglose: (pago: Pago) => void;
  onAnular: (pago: Pago) => void;
}

function EncabezadoOrdenable({
  column,
  children,
}: {
  column: Column<Pago, unknown>;
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

function formatearMoneda(valor: string) {
  return `S/ ${valor}`;
}

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE");
}

const METODO_LABEL: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  DEPOSITO: "Depósito",
  YAPE_PLIN: "Yape / Plin",
  OTRO: "Otro",
};

const ESTADO_VARIANTE: Record<Pago["estado"], "default" | "secondary" | "destructive"> = {
  CONFIRMADO: "default",
  ANULADO: "destructive",
  // Legado: ya no se producen, pero un pago histórico podría seguir mostrándolos.
  PENDIENTE_CONFIRMACION: "secondary",
  RECHAZADO: "destructive",
};

const ESTADO_LABEL: Record<Pago["estado"], string> = {
  CONFIRMADO: "Confirmado",
  ANULADO: "Anulado",
  PENDIENTE_CONFIRMACION: "Pendiente",
  RECHAZADO: "Rechazado",
};

export function crearColumnasPagos({
  esAdministrador,
  onVerDesglose,
  onAnular,
}: ColumnasPagosOpciones): ColumnDef<Pago>[] {
  return [
    {
      id: "cuota",
      accessorFn: (pago) => pago.cuota?.numero ?? 0,
      header: "Cuota",
      cell: ({ row }) =>
        row.original.prestamo ? (
          <Link href={`/prestamos/${row.original.prestamo.id}`} className="hover:underline">
            {row.original.cuota ? `#${row.original.cuota.numero}` : "—"}
          </Link>
        ) : (
          row.original.cuota ? `#${row.original.cuota.numero}` : "—"
        ),
    },
    {
      accessorKey: "monto",
      header: ({ column }) => <EncabezadoOrdenable column={column}>Monto</EncabezadoOrdenable>,
      cell: ({ row }) => formatearMoneda(row.original.monto),
    },
    {
      accessorKey: "metodo",
      header: "Método",
      cell: ({ row }) => METODO_LABEL[row.original.metodo] ?? row.original.metodo,
    },
    {
      accessorKey: "fechaPago",
      header: ({ column }) => <EncabezadoOrdenable column={column}>Fecha</EncabezadoOrdenable>,
      cell: ({ row }) => formatearFecha(row.original.fechaPago),
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ row }) => (
        <Badge variant={ESTADO_VARIANTE[row.original.estado]}>
          {ESTADO_LABEL[row.original.estado]}
        </Badge>
      ),
    },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => {
        const pago = row.original;
        const puedeAnular = pago.estado === "CONFIRMADO";
        return (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
              <MoreHorizontal className="size-4" />
              <span className="sr-only">Acciones</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onVerDesglose(pago)}>Ver desglose</DropdownMenuItem>
              {esAdministrador && puedeAnular && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => onAnular(pago)}>
                    Anular
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
