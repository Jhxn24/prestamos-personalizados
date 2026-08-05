"use client";

import type { Column, ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Prestamo } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function EncabezadoOrdenable({
  column,
  children,
}: {
  column: Column<Prestamo, unknown>;
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

const MODALIDAD_LABEL: Record<string, string> = {
  INTERES_FIJO: "Interés fijo",
  INTERES_SOBRE_SALDO: "Interés sobre saldo",
  CUOTAS_FIJAS: "Cuotas fijas",
  CAPITAL_AL_FINAL: "Capital al final",
};

export const columnasPrestamos: ColumnDef<Prestamo>[] = [
  {
    id: "cliente",
    accessorFn: (prestamo) =>
      prestamo.cliente ? `${prestamo.cliente.nombre} ${prestamo.cliente.apellido}` : "",
    header: ({ column }) => <EncabezadoOrdenable column={column}>Cliente</EncabezadoOrdenable>,
    cell: ({ row }) =>
      row.original.cliente ? (
        <Link href={`/clientes/${row.original.cliente.id}`} className="font-medium hover:underline">
          {row.original.cliente.nombre} {row.original.cliente.apellido}
        </Link>
      ) : (
        "—"
      ),
  },
  {
    accessorKey: "capital",
    header: ({ column }) => <EncabezadoOrdenable column={column}>Capital</EncabezadoOrdenable>,
    cell: ({ row }) => formatearMoneda(row.original.capital),
  },
  {
    accessorKey: "modalidad",
    header: "Modalidad",
    cell: ({ row }) => MODALIDAD_LABEL[row.original.modalidad] ?? row.original.modalidad,
  },
  {
    accessorKey: "numeroCuotas",
    header: "Cuotas",
  },
  {
    accessorKey: "fechaDesembolso",
    header: ({ column }) => <EncabezadoOrdenable column={column}>Desembolso</EncabezadoOrdenable>,
    cell: ({ row }) => formatearFecha(row.original.fechaDesembolso),
  },
  {
    accessorKey: "estado",
    header: "Estado",
    cell: ({ row }) => (
      <Badge variant={row.original.estado === "ACTIVO" ? "default" : "secondary"}>
        {row.original.estado}
      </Badge>
    ),
  },
  {
    id: "acciones",
    header: "",
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        render={<Link href={`/prestamos/${row.original.id}`} />}
        nativeButton={false}
      >
        Ver detalle
      </Button>
    ),
  },
];
