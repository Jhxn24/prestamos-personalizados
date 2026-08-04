"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { listarClientes } from "@/lib/clientes-api";
import type { Cliente } from "@/lib/types";
import { DataTable } from "@/components/ui/data-table";
import { crearColumnasClientes } from "@/components/clientes/columns";
import { ClienteFormSheet } from "@/components/clientes/cliente-form-sheet";
import { DesactivarClienteDialog } from "@/components/clientes/desactivar-cliente-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function ClientesPage() {
  const { token, usuario } = useAuth();
  const router = useRouter();

  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [cargando, setCargando] = useState(true);

  const [sheetAbierto, setSheetAbierto] = useState(false);
  const [modoSheet, setModoSheet] = useState<"crear" | "editar">("crear");
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);

  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [clienteADesactivar, setClienteADesactivar] = useState<Cliente | null>(null);

  useEffect(() => {
    if (usuario && usuario.rol !== "ADMINISTRADOR") {
      router.replace("/dashboard");
    }
  }, [usuario, router]);

  useEffect(() => {
    if (!token || usuario?.rol !== "ADMINISTRADOR") return;
    let activo = true;

    async function cargarClientes() {
      setCargando(true);
      try {
        const respuesta = await listarClientes(token!);
        if (activo) setClientes(respuesta);
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : "No se pudo cargar la lista de clientes");
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargarClientes();

    return () => {
      activo = false;
    };
  }, [token, usuario]);

  function abrirCrear() {
    setClienteSeleccionado(null);
    setModoSheet("crear");
    setSheetAbierto(true);
  }

  function abrirEditar(cliente: Cliente) {
    setClienteSeleccionado(cliente);
    setModoSheet("editar");
    setSheetAbierto(true);
  }

  function abrirDesactivar(cliente: Cliente) {
    setClienteADesactivar(cliente);
    setDialogoAbierto(true);
  }

  function alGuardar(cliente: Cliente) {
    setClientes((actual) => {
      if (!actual) return [cliente];
      const existe = actual.some((item) => item.id === cliente.id);
      return existe
        ? actual.map((item) => (item.id === cliente.id ? cliente : item))
        : [cliente, ...actual];
    });
  }

  const columnas = crearColumnasClientes({
    onVerDetalle: (cliente) => router.push(`/clientes/${cliente.id}`),
    onEditar: abrirEditar,
    onDesactivar: abrirDesactivar,
  });

  if (usuario && usuario.rol !== "ADMINISTRADOR") {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clientes</h1>
        <Button onClick={abrirCrear}>Nuevo cliente</Button>
      </div>

      {cargando || !clientes ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, indice) => (
            <Skeleton key={indice} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <DataTable columns={columnas} data={clientes} searchPlaceholder="Buscar por nombre, documento o email..." />
      )}

      <ClienteFormSheet
        open={sheetAbierto}
        onOpenChange={setSheetAbierto}
        modo={modoSheet}
        cliente={clienteSeleccionado}
        onSuccess={alGuardar}
      />

      <DesactivarClienteDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        cliente={clienteADesactivar}
        onSuccess={alGuardar}
      />
    </div>
  );
}
