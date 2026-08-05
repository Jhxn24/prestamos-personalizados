import { useEffect, useState } from 'react';
import { Alert, Modal, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';

interface GenerarAccesoModalProps {
  visible: boolean;
  onCancelar: () => void;
  onEnviar: (email: string, password: string) => Promise<void>;
}

/** Agrega una cuenta de acceso a un cliente que no tenía (RF-04 opcional). */
export function GenerarAccesoModal({ visible, onCancelar, onEnviar }: GenerarAccesoModalProps) {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (visible) {
      setEmail('');
      setPassword('');
    }
  }, [visible]);

  async function enviar() {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Email inválido', 'Ingresa un email válido.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Contraseña inválida', 'Debe tener al menos 6 caracteres.');
      return;
    }

    setEnviando(true);
    try {
      await onEnviar(email.trim(), password);
    } catch (error) {
      Alert.alert('No se pudo generar el acceso', error instanceof ApiError ? error.message : 'Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancelar}>
      <View style={styles.overlay}>
        <ThemedView style={[styles.content, { borderColor: theme.border }]}>
          <ThemedText type="smallBold">Generar acceso</ThemedText>
          <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextField label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
          <View style={styles.actions}>
            <Button title="Cancelar" variant="secondary" onPress={onCancelar} />
            <Button title="Generar acceso" onPress={enviar} loading={enviando} />
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
