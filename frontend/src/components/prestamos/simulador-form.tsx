"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { simularPrestamo } from "@/lib/prestamos-api";
import type {
  FrecuenciaPago,
  ModalidadPrestamo,
  SimularPrestamoInput,
  SimularPrestamoResponse,
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

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

const CAMPOS_INICIALES: CamposForm = {
  capital: "",
  tasaInteres: "",
  tipoInteres: "MENSUAL",
  frecuenciaPago: "MENSUAL",
  diasPersonalizados: "",
  numeroCuotas: "",
  modalidad: "CUOTAS_FIJAS",
  fechaDesembolso: hoyISO(),
};

interface SimuladorFormProps {
  onSimulado: (datos: SimularPrestamoInput, resultado: SimularPrestamoResponse) => void;
}

/**
 * Formulario de condiciones del préstamo. Solo simula (POST /prestamos/simular,
 * RF-09) — no persiste nada. El registro final lo dispara la página contenedora
 * una vez que hay una simulación y un cliente elegido.
 */
export function SimuladorForm({ onSimulado }: SimuladorFormProps) {
  const { token } = useAuth();
  const [campos, setCampos] = useState<CamposForm>(CAMPOS_INICIALES);
  const [errores, setErrores] = useState<Partial<Record<keyof CamposForm, string>>>({});
  const [simulando, setSimulando] = useState(false);

  function actualizarCampo<K extends keyof CamposForm>(campo: K, valor: CamposForm[K]) {
    setCampos((actual) => ({ ...actual, [campo]: valor }));
  }

  function validar(): SimularPrestamoInput | null {
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
    if (!token || !datos) return;

    setSimulando(true);
    try {
      const resultado = await simularPrestamo(token, datos);
      onSimulado(datos, resultado);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "No se pudo simular el préstamo");
    } finally {
      setSimulando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            onValueChange={(valor) => actualizarCampo("tipoInteres", valor as TipoInteres)}
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
            onValueChange={(valor) => actualizarCampo("modalidad", valor as ModalidadPrestamo)}
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
            onValueChange={(valor) => actualizarCampo("frecuenciaPago", valor as FrecuenciaPago)}
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

      <Button type="submit" disabled={simulando} className="self-start">
        {simulando ? "Simulando..." : "Simular cronograma"}
      </Button>
    </form>
  );
}
