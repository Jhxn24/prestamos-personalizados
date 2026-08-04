import type { PoliticaAbonoExtraordinario, PoliticaInteresAnticipado } from "@/lib/types";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OPCIONES_INTERES_ANTICIPADO: { value: PoliticaInteresAnticipado; label: string }[] = [
  { value: "COMPLETO", label: "Cobrar el interés completo del periodo" },
  { value: "PROPORCIONAL", label: "Cobrar solo el interés proporcional a los días" },
];

const OPCIONES_ABONO_EXTRAORDINARIO: { value: PoliticaAbonoExtraordinario; label: string }[] = [
  { value: "REDUCIR_CUOTA", label: "Reducir el monto de las cuotas restantes" },
  { value: "REDUCIR_PLAZO", label: "Reducir el plazo (menos cuotas)" },
];

interface PoliticasPagoFieldsProps {
  politicaInteresAnticipado: PoliticaInteresAnticipado;
  onPoliticaInteresAnticipadoChange: (valor: PoliticaInteresAnticipado) => void;
  politicaAbonoExtraordinario: PoliticaAbonoExtraordinario;
  onPoliticaAbonoExtraordinarioChange: (valor: PoliticaAbonoExtraordinario) => void;
}

/**
 * RF-14 (pago anticipado) y RF-17 (abono extraordinario): decisiones del
 * administrador. Solo tienen efecto real si el pago cae en ese escenario —
 * de lo contrario el backend las ignora — así que es seguro dejarlas
 * siempre visibles con sus valores por defecto.
 */
export function PoliticasPagoFields({
  politicaInteresAnticipado,
  onPoliticaInteresAnticipadoChange,
  politicaAbonoExtraordinario,
  onPoliticaAbonoExtraordinarioChange,
}: PoliticasPagoFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>Si el pago es anticipado</Label>
        <Select
          items={OPCIONES_INTERES_ANTICIPADO}
          value={politicaInteresAnticipado}
          onValueChange={(valor) =>
            onPoliticaInteresAnticipadoChange((valor as PoliticaInteresAnticipado) ?? "COMPLETO")
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPCIONES_INTERES_ANTICIPADO.map((opcion) => (
              <SelectItem key={opcion.value} value={opcion.value}>
                {opcion.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Si el monto excede lo que debe la cuota</Label>
        <Select
          items={OPCIONES_ABONO_EXTRAORDINARIO}
          value={politicaAbonoExtraordinario}
          onValueChange={(valor) =>
            onPoliticaAbonoExtraordinarioChange(
              (valor as PoliticaAbonoExtraordinario) ?? "REDUCIR_CUOTA"
            )
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPCIONES_ABONO_EXTRAORDINARIO.map((opcion) => (
              <SelectItem key={opcion.value} value={opcion.value}>
                {opcion.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
