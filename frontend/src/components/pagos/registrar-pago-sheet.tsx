"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { registrarPago } from "@/lib/pagos-api";
import type {
  CuotaPrestamo,
  MetodoPago,
  Pago,
  PoliticaAbonoExtraordinario,
  PoliticaInteresAnticipado,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PoliticasPagoFields } from "./politicas-pago-fields";

const METODOS: { value: MetodoPago; label: string }[] = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "DEPOSITO", label: "Depósito" },
  { value: "YAPE_PLIN", label: "Yape / Plin" },
  { value: "OTRO", label: "Otro" },
];

function montoPendiente(cuota: CuotaPrestamo) {
  return Math.max(Number(cuota.total) - Number(cuota.montoPagado), 0).toFixed(2);
}

interface RegistrarPagoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cuota: CuotaPrestamo | null;
  onSuccess: (pago: Pago) => void;
}

/**
 * Solo el administrador marca pagos (RF-25): se aplican de inmediato, sin
 * paso de confirmación aparte, así que las políticas (RF-14, RF-17) se
 * deciden acá mismo.
 */
export function RegistrarPagoSheet({ open, onOpenChange, cuota, onSuccess }: RegistrarPagoSheetProps) {
  const { token } = useAuth();

  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState<MetodoPago>("EFECTIVO");
  const [comprobanteUrl, setComprobanteUrl] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [politicaInteresAnticipado, setPoliticaInteresAnticipado] =
    useState<PoliticaInteresAnticipado>("COMPLETO");
  const [politicaAbonoExtraordinario, setPoliticaAbonoExtraordinario] =
    useState<PoliticaAbonoExtraordinario>("REDUCIR_CUOTA");
  const [errorMonto, setErrorMonto] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    function reiniciarFormulario() {
      if (!open || !cuota) return;
      setMonto(montoPendiente(cuota));
      setMetodo("EFECTIVO");
      setComprobanteUrl("");
      setObservaciones("");
      setPoliticaInteresAnticipado("COMPLETO");
      setPoliticaAbonoExtraordinario("REDUCIR_CUOTA");
      setErrorMonto(null);
    }
    reiniciarFormulario();
  }, [open, cuota]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token || !cuota) return;

    const montoNumero = Number(monto);
    if (!monto || Number.isNaN(montoNumero) || montoNumero <= 0) {
      setErrorMonto("Debe ser mayor a 0");
      return;
    }
    setErrorMonto(null);

    setEnviando(true);
    try {
      const pago = await registrarPago(token, {
        cuotaId: cuota.id,
        monto: montoNumero,
        metodo,
        comprobanteUrl: comprobanteUrl.trim() || undefined,
        observaciones: observaciones.trim() || undefined,
        politicaInteresAnticipado,
        politicaAbonoExtraordinario,
      });
      toast.success("Pago registrado");
      onSuccess(pago);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo registrar el pago");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Registrar pago</SheetTitle>
          <SheetDescription>
            {cuota ? `Cuota #${cuota.numero}` : ""} — se aplica de inmediato.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 px-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="monto">Monto (S/)</Label>
            <Input
              id="monto"
              type="number"
              step="0.01"
              min="0"
              value={monto}
              onChange={(event) => setMonto(event.target.value)}
            />
            {errorMonto && <p className="text-sm text-destructive">{errorMonto}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Método</Label>
            <Select items={METODOS} value={metodo} onValueChange={(valor) => setMetodo((valor as MetodoPago) ?? "EFECTIVO")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METODOS.map((opcion) => (
                  <SelectItem key={opcion.value} value={opcion.value}>
                    {opcion.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="comprobanteUrl">Comprobante (URL, opcional)</Label>
            <Input
              id="comprobanteUrl"
              value={comprobanteUrl}
              onChange={(event) => setComprobanteUrl(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="observaciones">Observaciones (opcional)</Label>
            <Textarea
              id="observaciones"
              value={observaciones}
              onChange={(event) => setObservaciones(event.target.value)}
            />
          </div>

          <PoliticasPagoFields
            politicaInteresAnticipado={politicaInteresAnticipado}
            onPoliticaInteresAnticipadoChange={setPoliticaInteresAnticipado}
            politicaAbonoExtraordinario={politicaAbonoExtraordinario}
            onPoliticaAbonoExtraordinarioChange={setPoliticaAbonoExtraordinario}
          />

          <SheetFooter className="px-0">
            <Button type="submit" disabled={enviando}>
              {enviando ? "Guardando..." : "Registrar pago"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
