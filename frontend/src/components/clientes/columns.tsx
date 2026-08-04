"use client";

import type { Column, ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Cliente } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ColumnasClientesOpciones {
  onVerDetalle: (cliente: Cliente) => void;
  onEditar: (cliente: Cliente) => void;
  onDesactivar: (cliente: Cliente) => void;
}

function EncabezadoOrdenable({
  column,
  children,
}: {
  column: Column<Cliente, unknown>;
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

export function crearColumnasClientes({
  onVerDetalle,
  onEditar,
  onDesactivar,
}: ColumnasClientesOpciones): ColumnDef<Cliente>[] {
  return [
    {
      id: "nombreCompleto",
      accessorFn: (cliente) => `${cliente.nombre} ${cliente.apellido}`,
      header: ({ column }) => <EncabezadoOrdenable column={column}>Nombre</EncabezadoOrdenable>,
      cell: ({ row }) => (
        <Link href={`/clientes/${row.original.id}`} className="font-medium hover:underline">
          {row.original.nombre} {row.original.apellido}
        </Link>
      ),
    },
    {
      accessorKey: "documento",
      header: ({ column }) => <EncabezadoOrdenable column={column}>Documento</EncabezadoOrdenable>,
    },
    {
      accessorKey: "telefono",
      header: "Teléfono",
      cell: ({ row }) => row.original.telefono ?? "—",
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      accessorKey: "activo",
      header: "Estado",
      cell: ({ row }) => (
        <Badge variant={row.original.activo ? "default" : "secondary"}>
          {row.original.activo ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => {
        const cliente = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
              <MoreHorizontal className="size-4" />
              <span className="sr-only">Acciones</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onVerDetalle(cliente)}>Ver detalle</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEditar(cliente)}>Editar</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={!cliente.activo}
                onClick={() => onDesactivar(cliente)}
              >
                Desactivar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
