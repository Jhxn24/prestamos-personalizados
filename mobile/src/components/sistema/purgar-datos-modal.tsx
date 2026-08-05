import { useEffect, useState } from 'react';
import { Alert, Modal, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { purgarDatos } from '@/lib/sistema-api';
import type { PurgarDatosResultado } from '@/lib/types';

const FRASE_CONFIRMACION = 'ELIMINAR TODO';

interface PurgarDatosModalProps {
  visible: boolean;
  onCancelar: () => void;
  onExito: (resultado: PurgarDatosResultado) => void;
}

/**
 * La acción más destructiva del sistema: borra TODOS los clientes, préstamos,
 * cuotas, pagos y cuentas de cliente. Irreversible. Pide la frase exacta y la
 * contraseña del administrador antes de dejar tocar el botón.
 */
export function PurgarDatosModal({ visible, onCancelar, onExito }: PurgarDatosModalProps) {
  const theme = useTheme();
  const { token } = useAuth();
  const [confirmacion, setConfirmacion] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (visible) {
      setConfirmacion('');
      setPassword('');
    }
  }, [visible]);

  const fraseValida = confirmacion === FRASE_CONFIRMACION;

  async function enviar() {
    if (!token || !fraseValida || !password) return;

    setEnviando(true);
    try {
      const resultado = await purgarDatos(token, { confirmacion, password });
      onExito(resultado);
    } catch (error) {
      Alert.alert('No se pudo completar el borrado', error instanceof ApiError ? error.message : 'Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancelar}>
      <View style={styles.overlay}>
        <ThemedView style={[styles.content, { borderColor: theme.border }]}>
          <ThemedText type="smallBold" themeColor="destructive">
            Eliminar todos los datos
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Esto borra permanentemente TODOS los clientes, préstamos, cuotas, pagos y cuentas de
            cliente. No se puede deshacer.
          </ThemedText>
          <TextField
            label={`Escribe "${FRASE_CONFIRMACION}" para confirmar`}
            value={confirmacion}
            onChangeText={setConfirmacion}
            autoCapitalize="characters"
          />
          <TextField label="Tu contraseña" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
          <View style={styles.actions}>
            <Button title="Cancelar" variant="secondary" onPress={onCancelar} />
            <Button
              title="Eliminar todo"
              variant="destructive"
              onPress={enviar}
              loading={enviando}
              disabled={!fraseValida || !password}
            />
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
