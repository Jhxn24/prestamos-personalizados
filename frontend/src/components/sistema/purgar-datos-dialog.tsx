"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { purgarDatos } from "@/lib/sistema-api";
import type { PurgarDatosResultado } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const FRASE_CONFIRMACION = "ELIMINAR TODO";

interface PurgarDatosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (resultado: PurgarDatosResultado) => void;
}

/**
 * La acción más destructiva del sistema: borra TODOS los clientes, préstamos,
 * cuotas, pagos y cuentas de cliente. Irreversible, sin papelera. Por eso pide
 * dos confirmaciones (frase exacta + contraseña), no solo un click.
 */
export function PurgarDatosDialog({ open, onOpenChange, onSuccess }: PurgarDatosDialogProps) {
  const { token } = useAuth();
  const [confirmacion, setConfirmacion] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    function reiniciar() {
      if (!open) return;
      setConfirmacion("");
      setPassword("");
    }
    reiniciar();
  }, [open]);

  const fraseValida = confirmacion === FRASE_CONFIRMACION;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token || !fraseValida || !password) return;

    setEnviando(true);
    try {
      const resultado = await purgarDatos(token, { confirmacion, password });
      toast.success(
        `Se eliminaron ${resultado.clientes} clientes, ${resultado.prestamos} préstamos y ${resultado.pagos} pagos.`
      );
      onSuccess(resultado);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo completar el borrado");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive">Eliminar todos los datos</DialogTitle>
          <DialogDescription>
            Esto borra permanentemente TODOS los clientes, préstamos, cuotas, pagos y cuentas de
            cliente. No se puede deshacer. La bitácora de auditoría queda intacta (incluida esta
            acción).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="frase-confirmacion">
              Escribe <span className="font-mono font-semibold">{FRASE_CONFIRMACION}</span> para confirmar
            </Label>
            <Input
              id="frase-confirmacion"
              value={confirmacion}
              onChange={(event) => setConfirmacion(event.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password-purgar">Tu contraseña</Label>
            <Input
              id="password-purgar"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="submit"
              variant="destructive"
              disabled={!fraseValida || !password || enviando}
            >
              {enviando ? "Eliminando..." : "Eliminar todo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
