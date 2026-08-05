"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { anularPago } from "@/lib/pagos-api";
import type { Pago } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

interface AnularPagoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pago: Pago | null;
  onSuccess: (pago: Pago) => void;
}

/** Anula un pago marcado por error, revirtiendo su efecto en el préstamo. */
export function AnularPagoDialog({ open, onOpenChange, pago, onSuccess }: AnularPagoDialogProps) {
  const { token } = useAuth();
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    function reiniciar() {
      if (open) setMotivo("");
    }
    reiniciar();
  }, [open]);

  async function anular() {
    if (!token || !pago) return;

    setEnviando(true);
    try {
      const actualizado = await anularPago(token, pago.id, { motivo: motivo.trim() || undefined });
      toast.success("Pago anulado");
      onSuccess(actualizado);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo anular el pago");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            ¿Anular el pago de {pago ? `S/ ${pago.monto}` : "este pago"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Se revierte su efecto en el préstamo: el capital pendiente, la cuota y el recibo vuelven
            al estado previo a este pago.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="motivoAnulacion">Motivo (opcional)</Label>
          <Textarea id="motivoAnulacion" value={motivo} onChange={(event) => setMotivo(event.target.value)} />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={enviando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={anular} disabled={enviando}>
            {enviando ? "Anulando..." : "Anular"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
