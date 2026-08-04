"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { desactivarCliente } from "@/lib/clientes-api";
import type { Cliente } from "@/lib/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DesactivarClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: Cliente | null;
  onSuccess: (cliente: Cliente) => void;
}

/** No existe endpoint para reactivar (backend/API.md): la acción es irreversible desde la UI. */
export function DesactivarClienteDialog({
  open,
  onOpenChange,
  cliente,
  onSuccess,
}: DesactivarClienteDialogProps) {
  const { token } = useAuth();
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    if (!token || !cliente) return;

    setEnviando(true);
    try {
      const actualizado = await desactivarCliente(token, cliente.id);
      toast.success("Cliente desactivado");
      onSuccess(actualizado);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo desactivar el cliente");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Desactivar a {cliente ? `${cliente.nombre} ${cliente.apellido}` : "este cliente"}?</AlertDialogTitle>
          <AlertDialogDescription>
            El cliente y su cuenta de acceso quedarán inactivos. No hay una acción para reactivarlo desde aquí.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={enviando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={confirmar} disabled={enviando}>
            {enviando ? "Desactivando..." : "Desactivar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
