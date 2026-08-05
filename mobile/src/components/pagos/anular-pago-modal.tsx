import { useEffect, useState } from 'react';
import { Alert, Modal, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';

interface AnularPagoModalProps {
  visible: boolean;
  onCancelar: () => void;
  onEnviar: (motivo: string | undefined) => Promise<void>;
}

/** Anula un pago marcado por error, revirtiendo su efecto en el préstamo. */
export function AnularPagoModal({ visible, onCancelar, onEnviar }: AnularPagoModalProps) {
  const theme = useTheme();
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (visible) setMotivo('');
  }, [visible]);

  async function enviar() {
    setEnviando(true);
    try {
      await onEnviar(motivo.trim() || undefined);
    } catch (error) {
      Alert.alert('No se pudo anular', error instanceof ApiError ? error.message : 'Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancelar}>
      <View style={styles.overlay}>
        <ThemedView style={[styles.content, { borderColor: theme.border }]}>
          <ThemedText type="smallBold">Anular pago</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Se revierte su efecto en el préstamo: el capital pendiente, la cuota y el recibo vuelven al
            estado previo a este pago.
          </ThemedText>
          <TextField
            label="Motivo (opcional)"
            value={motivo}
            onChangeText={setMotivo}
            multiline
            placeholder="Ej: monto equivocado"
          />
          <View style={styles.actions}>
            <Button title="Cancelar" variant="secondary" onPress={onCancelar} />
            <Button title="Anular" variant="destructive" onPress={enviar} loading={enviando} />
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
