import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ChipSelect } from '@/components/ui/chip-select';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import type { CamposCondiciones, ErroresCondiciones } from '@/lib/prestamo-form';
import type { FrecuenciaPago, ModalidadPrestamo, TipoInteres } from '@/lib/types';

const TIPOS_INTERES: { value: TipoInteres; label: string }[] = [
  { value: 'DIARIO', label: 'Diario' },
  { value: 'MENSUAL', label: 'Mensual' },
  { value: 'ANUAL', label: 'Anual' },
];

const FRECUENCIAS: { value: FrecuenciaPago; label: string }[] = [
  { value: 'DIARIA', label: 'Diaria' },
  { value: 'SEMANAL', label: 'Semanal' },
  { value: 'QUINCENAL', label: 'Quincenal' },
  { value: 'MENSUAL', label: 'Mensual' },
  { value: 'BIMESTRAL', label: 'Bimestral' },
  { value: 'TRIMESTRAL', label: 'Trimestral' },
  { value: 'PERSONALIZADA', label: 'Personalizada' },
];

const MODALIDADES: { value: ModalidadPrestamo; label: string }[] = [
  { value: 'INTERES_FIJO', label: 'Interés fijo' },
  { value: 'INTERES_SOBRE_SALDO', label: 'Interés sobre saldo' },
  { value: 'CUOTAS_FIJAS', label: 'Cuotas fijas' },
];

interface CondicionesFieldsProps {
  campos: CamposCondiciones;
  errores: ErroresCondiciones;
  onCambiar: <K extends keyof CamposCondiciones>(campo: K, valor: CamposCondiciones[K]) => void;
}

/** Mismos campos que frontend/simulador-form.tsx y ajustar-prestamo-sheet.tsx (RF-05/06/07). */
export function CondicionesFields({ campos, errores, onCambiar }: CondicionesFieldsProps) {
  return (
    <View style={{ gap: Spacing.three }}>
      <TextField
        label="Capital (S/)"
        value={campos.capital}
        onChangeText={(valor) => onCambiar('capital', valor)}
        keyboardType="decimal-pad"
        error={errores.capital}
      />
      <TextField
        label="Tasa de interés (%)"
        value={campos.tasaInteres}
        onChangeText={(valor) => onCambiar('tasaInteres', valor)}
        keyboardType="decimal-pad"
        error={errores.tasaInteres}
      />

      <View style={{ gap: Spacing.one }}>
        <ThemedText type="small" themeColor="textSecondary">
          Tipo de interés
        </ThemedText>
        <ChipSelect options={TIPOS_INTERES} value={campos.tipoInteres} onChange={(v) => onCambiar('tipoInteres', v)} />
      </View>

      <View style={{ gap: Spacing.one }}>
        <ThemedText type="small" themeColor="textSecondary">
          Modalidad
        </ThemedText>
        <ChipSelect options={MODALIDADES} value={campos.modalidad} onChange={(v) => onCambiar('modalidad', v)} />
      </View>

      <View style={{ gap: Spacing.one }}>
        <ThemedText type="small" themeColor="textSecondary">
          Frecuencia de pago
        </ThemedText>
        <ChipSelect
          options={FRECUENCIAS}
          value={campos.frecuenciaPago}
          onChange={(v) => onCambiar('frecuenciaPago', v)}
        />
      </View>

      {campos.frecuenciaPago === 'PERSONALIZADA' && (
        <TextField
          label="Días entre cuotas"
          value={campos.diasPersonalizados}
          onChangeText={(valor) => onCambiar('diasPersonalizados', valor)}
          keyboardType="number-pad"
          error={errores.diasPersonalizados}
        />
      )}

      <TextField
        label="N° de cuotas"
        value={campos.numeroCuotas}
        onChangeText={(valor) => onCambiar('numeroCuotas', valor)}
        keyboardType="number-pad"
        error={errores.numeroCuotas}
      />
      <TextField
        label="Fecha de desembolso (AAAA-MM-DD)"
        value={campos.fechaDesembolso}
        onChangeText={(valor) => onCambiar('fechaDesembolso', valor)}
        placeholder="2026-08-05"
        error={errores.fechaDesembolso}
      />
    </View>
  );
}
