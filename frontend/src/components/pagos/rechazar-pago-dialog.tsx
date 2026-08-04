"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { rechazarPago } from "@/lib/pagos-api";
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

interface RechazarPagoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pago: Pago | null;
  onSuccess: (pago: Pago) => void;
}

/** RF-23: rechaza un pago reportado. No mueve la contabilidad del préstamo. */
export function RechazarPagoDialog({ open, onOpenChange, pago, onSuccess }: RechazarPagoDialogProps) {
  const { token } = useAuth();
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    function reiniciar() {
      if (open) setMotivo("");
    }
    reiniciar();
  }, [open]);

  async function rechazar() {
    if (!token || !pago) return;

    setEnviando(true);
    try {
      const actualizado = await rechazarPago(token, pago.id, motivo.trim() || undefined);
      toast.success("Pago rechazado");
      onSuccess(actualizado);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo rechazar el pago");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            ¿Rechazar el pago de {pago ? `S/ ${pago.monto}` : "este pago"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            El cliente verá el pago como rechazado. No se modifica el saldo del préstamo.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="motivoRechazo">Motivo (opcional)</Label>
          <Textarea id="motivoRechazo" value={motivo} onChange={(event) => setMotivo(event.target.value)} />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={enviando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={rechazar} disabled={enviando}>
            {enviando ? "Rechazando..." : "Rechazar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
