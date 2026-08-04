"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { confirmarPago } from "@/lib/pagos-api";
import type { Pago, PoliticaAbonoExtraordinario, PoliticaInteresAnticipado } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PoliticasPagoFields } from "./politicas-pago-fields";

interface ConfirmarPagoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pago: Pago | null;
  onSuccess: (pago: Pago) => void;
}

/** RF-23: confirma un pago reportado; acá se resuelven RF-14 y RF-17. */
export function ConfirmarPagoDialog({ open, onOpenChange, pago, onSuccess }: ConfirmarPagoDialogProps) {
  const { token } = useAuth();
  const [politicaInteresAnticipado, setPoliticaInteresAnticipado] =
    useState<PoliticaInteresAnticipado>("COMPLETO");
  const [politicaAbonoExtraordinario, setPoliticaAbonoExtraordinario] =
    useState<PoliticaAbonoExtraordinario>("REDUCIR_CUOTA");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    function reiniciar() {
      if (!open) return;
      setPoliticaInteresAnticipado("COMPLETO");
      setPoliticaAbonoExtraordinario("REDUCIR_CUOTA");
    }
    reiniciar();
  }, [open]);

  async function confirmar() {
    if (!token || !pago) return;

    setEnviando(true);
    try {
      const actualizado = await confirmarPago(token, pago.id, {
        politicaInteresAnticipado,
        politicaAbonoExtraordinario,
      });
      toast.success("Pago confirmado");
      onSuccess(actualizado);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo confirmar el pago");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar pago</DialogTitle>
          <DialogDescription>
            {pago ? `S/ ${pago.monto} · cuota #${pago.cuota?.numero ?? "—"}` : ""}
          </DialogDescription>
        </DialogHeader>

        <PoliticasPagoFields
          politicaInteresAnticipado={politicaInteresAnticipado}
          onPoliticaInteresAnticipadoChange={setPoliticaInteresAnticipado}
          politicaAbonoExtraordinario={politicaAbonoExtraordinario}
          onPoliticaAbonoExtraordinarioChange={setPoliticaAbonoExtraordinario}
        />

        <DialogFooter>
          <Button onClick={confirmar} disabled={enviando}>
            {enviando ? "Confirmando..." : "Confirmar pago"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
