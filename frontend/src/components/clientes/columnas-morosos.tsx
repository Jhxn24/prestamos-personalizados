"use client";

import type { Column, ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Prestamo } from "@/lib/types";
import { Button } from "@/components/ui/button";

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

function formatearMoneda(valor: number) {
  return `S/ ${valor.toFixed(2)}`;
}

/** Mismo criterio que dashboard.service.js: cuotas VENCIDA de un préstamo ACTIVO. */
export function cuotasVencidas(prestamo: Prestamo) {
  return prestamo.cuotas.filter((cuota) => cuota.estado === "VENCIDA");
}

export function esMoroso(prestamo: Prestamo) {
  return prestamo.estado === "ACTIVO" && cuotasVencidas(prestamo).length > 0;
}

function diasAtrasoMaximo(prestamo: Prestamo) {
  return cuotasVencidas(prestamo).reduce((max, cuota) => Math.max(max, cuota.diasAtraso), 0);
}

function montoVencido(prestamo: Prestamo) {
  return cuotasVencidas(prestamo).reduce(
    (total, cuota) => total + (Number(cuota.total) - Number(cuota.montoPagado)),
    0
  );
}

export const columnasMorosos: ColumnDef<Prestamo>[] = [
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
    id: "cuotasVencidas",
    accessorFn: (prestamo) => cuotasVencidas(prestamo).length,
    header: ({ column }) => <EncabezadoOrdenable column={column}>Cuotas vencidas</EncabezadoOrdenable>,
  },
  {
    id: "diasAtraso",
    accessorFn: diasAtrasoMaximo,
    header: ({ column }) => <EncabezadoOrdenable column={column}>Días de atraso</EncabezadoOrdenable>,
  },
  {
    id: "montoVencido",
    accessorFn: montoVencido,
    header: ({ column }) => <EncabezadoOrdenable column={column}>Monto vencido</EncabezadoOrdenable>,
    cell: ({ row }) => formatearMoneda(montoVencido(row.original)),
  },
  {
    accessorKey: "moraAcumulada",
    header: ({ column }) => <EncabezadoOrdenable column={column}>Mora acumulada</EncabezadoOrdenable>,
    cell: ({ row }) => `S/ ${row.original.moraAcumulada}`,
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
        Ver préstamo
      </Button>
    ),
  },
];
