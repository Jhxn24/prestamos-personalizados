"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { obtenerCliente } from "@/lib/clientes-api";
import type { Cliente } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ClienteFormSheet } from "@/components/clientes/cliente-form-sheet";
import { DesactivarClienteDialog } from "@/components/clientes/desactivar-cliente-dialog";

export function ClienteDetalle({ id }: { id: string }) {
  const { token, usuario } = useAuth();
  const router = useRouter();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [cargando, setCargando] = useState(true);
  const [noEncontrado, setNoEncontrado] = useState(false);

  const [sheetAbierto, setSheetAbierto] = useState(false);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);

  useEffect(() => {
    if (usuario && usuario.rol !== "ADMINISTRADOR") {
      router.replace("/dashboard");
    }
  }, [usuario, router]);

  useEffect(() => {
    if (!token || usuario?.rol !== "ADMINISTRADOR") return;
    let activo = true;

    async function cargarCliente() {
      setCargando(true);
      try {
        const respuesta = await obtenerCliente(token!, id);
        if (activo) setCliente(respuesta);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          if (activo) setNoEncontrado(true);
        } else {
          toast.error(error instanceof ApiError ? error.message : "No se pudo cargar el cliente");
        }
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargarCliente();

    return () => {
      activo = false;
    };
  }, [token, usuario, id]);

  if (usuario && usuario.rol !== "ADMINISTRADOR") {
    return null;
  }

  if (cargando) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (noEncontrado || !cliente) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">Cliente no encontrado.</p>
        <Link href="/clientes" className="text-sm font-medium underline">
          Volver a clientes
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/clientes" className="text-sm text-muted-foreground hover:underline">
            ← Clientes
          </Link>
          <h1 className="text-xl font-semibold">
            {cliente.nombre} {cliente.apellido}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setSheetAbierto(true)}>
            Editar
          </Button>
          <Button
            variant="destructive"
            disabled={!cliente.activo}
            onClick={() => setDialogoAbierto(true)}
          >
            Desactivar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Datos del cliente</CardTitle>
          <Badge variant={cliente.activo ? "default" : "secondary"}>
            {cliente.activo ? "Activo" : "Inactivo"}
          </Badge>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">Documento</p>
            <p className="font-medium">{cliente.documento}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Teléfono</p>
            <p className="font-medium">{cliente.telefono ?? "—"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="font-medium">{cliente.email}</p>
          </div>
          <div className="col-span-2 sm:col-span-3">
            <p className="text-sm text-muted-foreground">Dirección</p>
            <p className="font-medium">{cliente.direccion ?? "—"}</p>
          </div>
        </CardContent>
      </Card>

      <ClienteFormSheet
        open={sheetAbierto}
        onOpenChange={setSheetAbierto}
        modo="editar"
        cliente={cliente}
        onSuccess={setCliente}
      />

      <DesactivarClienteDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        cliente={cliente}
        onSuccess={setCliente}
      />
    </div>
  );
}
