import type { Pago } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function formatearMoneda(valor: string) {
  return `S/ ${valor}`;
}

function formatearFecha(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("es-PE") : "—";
}

const ESTADO_VARIANTE: Record<Pago["estado"], "default" | "secondary" | "destructive"> = {
  CONFIRMADO: "default",
  ANULADO: "destructive",
  PENDIENTE_CONFIRMACION: "secondary",
  RECHAZADO: "destructive",
};

const ESTADO_LABEL: Record<Pago["estado"], string> = {
  CONFIRMADO: "Confirmado",
  ANULADO: "Anulado",
  PENDIENTE_CONFIRMACION: "Pendiente de confirmación",
  RECHAZADO: "Rechazado",
};

interface VerDesglosePagoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pago: Pago | null;
}

/** Vista de solo lectura: cómo se repartió el pago (RF-10) y su recibo (RF-24). */
export function VerDesglosePagoDialog({ open, onOpenChange, pago }: VerDesglosePagoDialogProps) {
  if (!pago) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            Desglose del pago
            <Badge variant={ESTADO_VARIANTE[pago.estado]}>{ESTADO_LABEL[pago.estado]}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Monto</p>
            <p className="font-medium">{formatearMoneda(pago.monto)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Cuota</p>
            <p className="font-medium">{pago.cuota ? `#${pago.cuota.numero}` : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Fecha de pago</p>
            <p className="font-medium">{formatearFecha(pago.fechaPago)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Fecha de confirmación</p>
            <p className="font-medium">{formatearFecha(pago.fechaConfirmacion)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Capital aplicado</p>
            <p className="font-medium">{formatearMoneda(pago.capitalAplicado)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Interés aplicado</p>
            <p className="font-medium">{formatearMoneda(pago.interesAplicado)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Mora aplicada</p>
            <p className="font-medium">{formatearMoneda(pago.moraAplicada)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Excedente</p>
            <p className="font-medium">{formatearMoneda(pago.excedente)}</p>
          </div>
          {Number(pago.interesCondonado) > 0 && (
            <div>
              <p className="text-muted-foreground">Interés condonado</p>
              <p className="font-medium">{formatearMoneda(pago.interesCondonado)}</p>
            </div>
          )}
          {pago.cuotasEliminadas > 0 && (
            <div>
              <p className="text-muted-foreground">Cuotas eliminadas</p>
              <p className="font-medium">{pago.cuotasEliminadas}</p>
            </div>
          )}
          {pago.recibo && (
            <div>
              <p className="text-muted-foreground">Recibo</p>
              <p className="font-medium">#{pago.recibo.numero}</p>
            </div>
          )}
          {pago.motivoRechazo && (
            <div className="col-span-2">
              <p className="text-muted-foreground">Motivo de rechazo</p>
              <p className="font-medium">{pago.motivoRechazo}</p>
            </div>
          )}
          {pago.estado === "ANULADO" && (
            <div className="col-span-2">
              <p className="text-muted-foreground">Anulado</p>
              <p className="font-medium">
                {formatearFecha(pago.fechaAnulacion)}
                {pago.motivoAnulacion ? ` · ${pago.motivoAnulacion}` : ""}
              </p>
            </div>
          )}
          {pago.observaciones && (
            <div className="col-span-2">
              <p className="text-muted-foreground">Observaciones</p>
              <p className="font-medium">{pago.observaciones}</p>
            </div>
          )}
          {pago.comprobanteUrl && (
            <div className="col-span-2">
              <p className="text-muted-foreground">Comprobante</p>
              <a
                href={pago.comprobanteUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary underline"
              >
                {pago.comprobanteUrl}
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
