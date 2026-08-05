import { useEffect, useState } from 'react';
import { Alert, Modal, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { ChipSelect } from '@/components/ui/chip-select';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';
import type { MetodoPago, PoliticaAbonoExtraordinario, PoliticaInteresAnticipado } from '@/lib/types';

const METODOS: { value: MetodoPago; label: string }[] = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'DEPOSITO', label: 'Depósito' },
  { value: 'YAPE_PLIN', label: 'Yape/Plin' },
  { value: 'OTRO', label: 'Otro' },
];

const POLITICAS_INTERES: { value: PoliticaInteresAnticipado; label: string }[] = [
  { value: 'COMPLETO', label: 'Interés completo' },
  { value: 'PROPORCIONAL', label: 'Proporcional a los días' },
];

const POLITICAS_ABONO: { value: PoliticaAbonoExtraordinario; label: string }[] = [
  { value: 'REDUCIR_CUOTA', label: 'Reducir cuota' },
  { value: 'REDUCIR_PLAZO', label: 'Reducir plazo' },
];

export interface DatosRegistrarPago {
  monto: number;
  metodo: MetodoPago;
  comprobanteUrl?: string;
  observaciones?: string;
  politicaInteresAnticipado: PoliticaInteresAnticipado;
  politicaAbonoExtraordinario: PoliticaAbonoExtraordinario;
}

interface RegistrarPagoModalProps {
  visible: boolean;
  titulo: string;
  montoInicial: string;
  textoSubmit: string;
  onCancelar: () => void;
  onEnviar: (datos: DatosRegistrarPago) => Promise<void>;
}

/**
 * RF-25: solo el administrador marca pagos; se aplican de inmediato, así que
 * las políticas de interés anticipado (RF-14) y abono extraordinario (RF-17)
 * se deciden acá mismo, sin un paso de confirmación aparte.
 */
export function RegistrarPagoModal({
  visible,
  titulo,
  montoInicial,
  textoSubmit,
  onCancelar,
  onEnviar,
}: RegistrarPagoModalProps) {
  const theme = useTheme();
  const [monto, setMonto] = useState(montoInicial);
  const [metodo, setMetodo] = useState<MetodoPago>('EFECTIVO');
  const [comprobanteUrl, setComprobanteUrl] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [politicaInteresAnticipado, setPoliticaInteresAnticipado] =
    useState<PoliticaInteresAnticipado>('COMPLETO');
  const [politicaAbonoExtraordinario, setPoliticaAbonoExtraordinario] =
    useState<PoliticaAbonoExtraordinario>('REDUCIR_CUOTA');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (visible) {
      setMonto(montoInicial);
      setMetodo('EFECTIVO');
      setComprobanteUrl('');
      setObservaciones('');
      setPoliticaInteresAnticipado('COMPLETO');
      setPoliticaAbonoExtraordinario('REDUCIR_CUOTA');
    }
  }, [visible, montoInicial]);

  async function enviar() {
    const montoNumero = Number(monto);
    if (!monto || Number.isNaN(montoNumero) || montoNumero <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto mayor a 0.');
      return;
    }

    setEnviando(true);
    try {
      await onEnviar({
        monto: montoNumero,
        metodo,
        comprobanteUrl: comprobanteUrl.trim() || undefined,
        observaciones: observaciones.trim() || undefined,
        politicaInteresAnticipado,
        politicaAbonoExtraordinario,
      });
    } catch (error) {
      Alert.alert('No se pudo registrar el pago', error instanceof ApiError ? error.message : 'Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancelar}>
      <View style={styles.overlay}>
        <ThemedView style={[styles.content, { borderColor: theme.border }]}>
          <ThemedText type="smallBold">{titulo}</ThemedText>

          <TextField label="Monto (S/)" value={monto} onChangeText={setMonto} keyboardType="decimal-pad" />
          <ChipSelect options={METODOS} value={metodo} onChange={setMetodo} />
          <TextField
            label="Comprobante (URL, opcional)"
            value={comprobanteUrl}
            onChangeText={setComprobanteUrl}
            autoCapitalize="none"
          />
          <TextField label="Observaciones (opcional)" value={observaciones} onChangeText={setObservaciones} multiline />

          <View style={{ gap: Spacing.one }}>
            <ThemedText type="small" themeColor="textSecondary">
              Interés anticipado (si se paga antes del vencimiento)
            </ThemedText>
            <ChipSelect
              options={POLITICAS_INTERES}
              value={politicaInteresAnticipado}
              onChange={setPoliticaInteresAnticipado}
            />
          </View>

          <View style={{ gap: Spacing.one }}>
            <ThemedText type="small" themeColor="textSecondary">
              Abono extraordinario (si el pago supera lo que debe la cuota)
            </ThemedText>
            <ChipSelect
              options={POLITICAS_ABONO}
              value={politicaAbonoExtraordinario}
              onChange={setPoliticaAbonoExtraordinario}
            />
          </View>

          <View style={styles.actions}>
            <Button title="Cancelar" variant="secondary" onPress={onCancelar} />
            <Button title={textoSubmit} onPress={enviar} loading={enviando} />
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  content: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'flex-end',
  },
});
