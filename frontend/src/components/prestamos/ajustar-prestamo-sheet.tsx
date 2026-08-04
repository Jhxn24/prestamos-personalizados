"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { recalcularPrestamo, refinanciarPrestamo } from "@/lib/prestamos-api";
import type {
  FrecuenciaPago,
  ModalidadPrestamo,
  Prestamo,
  SimularPrestamoInput,
  TipoInteres,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const TIPOS_INTERES: { value: TipoInteres; label: string }[] = [
  { value: "DIARIO", label: "Diario" },
  { value: "MENSUAL", label: "Mensual" },
  { value: "ANUAL", label: "Anual" },
];

const FRECUENCIAS: { value: FrecuenciaPago; label: string }[] = [
  { value: "DIARIA", label: "Diaria" },
  { value: "SEMANAL", label: "Semanal" },
  { value: "QUINCENAL", label: "Quincenal" },
  { value: "MENSUAL", label: "Mensual" },
  { value: "BIMESTRAL", label: "Bimestral" },
  { value: "TRIMESTRAL", label: "Trimestral" },
  { value: "PERSONALIZADA", label: "Personalizada (n días)" },
];

const MODALIDADES: { value: ModalidadPrestamo; label: string }[] = [
  { value: "INTERES_FIJO", label: "Interés fijo" },
  { value: "INTERES_SOBRE_SALDO", label: "Interés sobre saldo" },
  { value: "CUOTAS_FIJAS", label: "Cuotas fijas" },
];

interface CamposForm {
  capital: string;
  tasaInteres: string;
  tipoInteres: TipoInteres;
  frecuenciaPago: FrecuenciaPago;
  diasPersonalizados: string;
  numeroCuotas: string;
  modalidad: ModalidadPrestamo;
  fechaDesembolso: string;
}

function soloFecha(iso: string) {
  return iso.slice(0, 10);
}

function camposDesdePrestamo(prestamo: Prestamo, modo: "recalcular" | "refinanciar"): CamposForm {
  return {
    capital: modo === "refinanciar" ? prestamo.capitalPendiente : prestamo.capital,
    tasaInteres: prestamo.tasaInteres,
    tipoInteres: prestamo.tipoInteres,
    frecuenciaPago: prestamo.frecuenciaPago,
    diasPersonalizados: prestamo.diasPersonalizados ? String(prestamo.diasPersonalizados) : "",
    numeroCuotas: String(prestamo.numeroCuotas),
    modalidad: prestamo.modalidad,
    fechaDesembolso:
      modo === "refinanciar" ? new Date().toISOString().slice(0, 10) : soloFecha(prestamo.fechaDesembolso),
  };
}

interface AjustarPrestamoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modo: "recalcular" | "refinanciar";
  prestamo: Prestamo | null;
  onSuccess: (prestamo: Prestamo) => void;
}

/**
 * Mismos campos que SimuladorForm, pero sin paso de simulación previo: acá
 * se aplica directo (RF-08/RF-09), no hay endpoint de preview para estas dos
 * operaciones. Se duplica el set de campos/validación a propósito en vez de
 * reutilizar SimuladorForm, para no tocar un componente ya probado.
 */
export function AjustarPrestamoSheet({
  open,
  onOpenChange,
  modo,
  prestamo,
  onSuccess,
}: AjustarPrestamoSheetProps) {
  const { token } = useAuth();
  const [campos, setCampos] = useState<CamposForm | null>(null);
  const [errores, setErrores] = useState<Partial<Record<keyof CamposForm, string>>>({});
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    function reiniciar() {
      if (!open || !prestamo) return;
      setCampos(camposDesdePrestamo(prestamo, modo));
      setErrores({});
    }
    reiniciar();
  }, [open, prestamo, modo]);

  function actualizarCampo<K extends keyof CamposForm>(campo: K, valor: CamposForm[K]) {
    setCampos((actual) => (actual ? { ...actual, [campo]: valor } : actual));
  }

  function validar(): SimularPrestamoInput | null {
    if (!campos) return null;
    const nuevosErrores: Partial<Record<keyof CamposForm, string>> = {};

    const capital = Number(campos.capital);
    if (!campos.capital || Number.isNaN(capital) || capital <= 0) {
      nuevosErrores.capital = "Debe ser mayor a 0";
    }

    const tasaInteres = Number(campos.tasaInteres);
    if (!campos.tasaInteres || Number.isNaN(tasaInteres) || tasaInteres <= 0) {
      nuevosErrores.tasaInteres = "Debe ser mayor a 0";
    }

    const numeroCuotas = Number(campos.numeroCuotas);
    if (!campos.numeroCuotas || !Number.isInteger(numeroCuotas) || numeroCuotas <= 0) {
      nuevosErrores.numeroCuotas = "Debe ser un entero mayor a 0";
    }

    let diasPersonalizados: number | undefined;
    if (campos.frecuenciaPago === "PERSONALIZADA") {
      diasPersonalizados = Number(campos.diasPersonalizados);
      if (!campos.diasPersonalizados || !Number.isInteger(diasPersonalizados) || diasPersonalizados <= 0) {
        nuevosErrores.diasPersonalizados = "Debe ser un entero mayor a 0";
      }
    }

    if (!campos.fechaDesembolso) {
      nuevosErrores.fechaDesembolso = "Obligatorio";
    }

    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length > 0) return null;

    return {
      capital,
      tasaInteres,
      tipoInteres: campos.tipoInteres,
      frecuenciaPago: campos.frecuenciaPago,
      diasPersonalizados,
      numeroCuotas,
      modalidad: campos.modalidad,
      fechaDesembolso: campos.fechaDesembolso,
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const datos = validar();
    if (!token || !prestamo || !datos) return;

    setEnviando(true);
    try {
      const resultado =
        modo === "recalcular"
          ? await recalcularPrestamo(token, prestamo.id, datos)
          : await refinanciarPrestamo(token, prestamo.id, datos);
      toast.success(modo === "recalcular" ? "Préstamo recalculado" : "Préstamo refinanciado");
      onSuccess(resultado);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo completar la operación");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{modo === "recalcular" ? "Recalcular préstamo" : "Refinanciar préstamo"}</SheetTitle>
          <SheetDescription>
            {modo === "recalcular"
              ? "Reemplaza el cronograma pendiente con estas condiciones. Solo es posible si el préstamo no tiene pagos registrados."
              : "Cierra este préstamo y crea uno nuevo por el saldo pendiente, con las condiciones que definas."}
          </SheetDescription>
        </SheetHeader>

        {campos && (
          <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 px-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="capital">Capital (S/)</Label>
                <Input
                  id="capital"
                  type="number"
                  step="0.01"
                  min="0"
                  value={campos.capital}
                  onChange={(event) => actualizarCampo("capital", event.target.value)}
                />
                {errores.capital && <p className="text-sm text-destructive">{errores.capital}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="tasaInteres">Tasa de interés (%)</Label>
                <Input
                  id="tasaInteres"
                  type="number"
                  step="any"
                  min="0"
                  value={campos.tasaInteres}
                  onChange={(event) => actualizarCampo("tasaInteres", event.target.value)}
                />
                {errores.tasaInteres && <p className="text-sm text-destructive">{errores.tasaInteres}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Tipo de interés</Label>
                <Select
                  items={TIPOS_INTERES}
                  value={campos.tipoInteres}
                  onValueChange={(valor) => actualizarCampo("tipoInteres", (valor as TipoInteres) ?? "MENSUAL")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_INTERES.map((opcion) => (
                      <SelectItem key={opcion.value} value={opcion.value}>
                        {opcion.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Modalidad</Label>
                <Select
                  items={MODALIDADES}
                  value={campos.modalidad}
                  onValueChange={(valor) =>
                    actualizarCampo("modalidad", (valor as ModalidadPrestamo) ?? "CUOTAS_FIJAS")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODALIDADES.map((opcion) => (
                      <SelectItem key={opcion.value} value={opcion.value}>
                        {opcion.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label>Frecuencia de pago</Label>
                <Select
                  items={FRECUENCIAS}
                  value={campos.frecuenciaPago}
                  onValueChange={(valor) =>
                    actualizarCampo("frecuenciaPago", (valor as FrecuenciaPago) ?? "MENSUAL")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FRECUENCIAS.map((opcion) => (
                      <SelectItem key={opcion.value} value={opcion.value}>
                        {opcion.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {campos.frecuenciaPago === "PERSONALIZADA" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="diasPersonalizados">Días entre cuotas</Label>
                  <Input
                    id="diasPersonalizados"
                    type="number"
                    step="1"
                    min="1"
                    value={campos.diasPersonalizados}
                    onChange={(event) => actualizarCampo("diasPersonalizados", event.target.value)}
                  />
                  {errores.diasPersonalizados && (
                    <p className="text-sm text-destructive">{errores.diasPersonalizados}</p>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="numeroCuotas">N° de cuotas</Label>
                <Input
                  id="numeroCuotas"
                  type="number"
                  step="1"
                  min="1"
                  value={campos.numeroCuotas}
                  onChange={(event) => actualizarCampo("numeroCuotas", event.target.value)}
                />
                {errores.numeroCuotas && <p className="text-sm text-destructive">{errores.numeroCuotas}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="fechaDesembolso">Fecha de desembolso</Label>
                <Input
                  id="fechaDesembolso"
                  type="date"
                  value={campos.fechaDesembolso}
                  onChange={(event) => actualizarCampo("fechaDesembolso", event.target.value)}
                />
                {errores.fechaDesembolso && (
                  <p className="text-sm text-destructive">{errores.fechaDesembolso}</p>
                )}
              </div>
            </div>

            <SheetFooter className="px-0">
              <Button type="submit" disabled={enviando}>
                {enviando ? "Guardando..." : modo === "recalcular" ? "Recalcular" : "Refinanciar"}
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
