import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { PurgarDatosModal } from '@/components/sistema/purgar-datos-modal';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cambiarPassword } from '@/lib/auth-api';

/** Cambio de la propia contraseña, igual para cliente y administrador. */
export function CuentaScreen() {
  const { token, usuario } = useAuth();

  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [confirmarNueva, setConfirmarNueva] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [purgarVisible, setPurgarVisible] = useState(false);

  async function guardar() {
    if (!token) return;
    if (passwordNueva.length < 6) {
      Alert.alert('Contraseña muy corta', 'Debe tener al menos 6 caracteres.');
      return;
    }
    if (passwordNueva !== confirmarNueva) {
      Alert.alert('Las contraseñas no coinciden', 'Revisa la confirmación.');
      return;
    }

    setEnviando(true);
    try {
      await cambiarPassword(token, { passwordActual, passwordNueva });
      Alert.alert('Listo', 'Tu contraseña fue actualizada.');
      setPasswordActual('');
      setPasswordNueva('');
      setConfirmarNueva('');
    } catch (error) {
      Alert.alert('No se pudo cambiar la contraseña', error instanceof ApiError ? error.message : 'Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Screen>
      <Card>
        <ThemedText type="smallBold">Cambiar contraseña</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {usuario?.email}
        </ThemedText>
        <TextField
          label="Contraseña actual"
          value={passwordActual}
          onChangeText={setPasswordActual}
          secureTextEntry
          autoCapitalize="none"
        />
        <TextField
          label="Nueva contraseña"
          value={passwordNueva}
          onChangeText={setPasswordNueva}
          secureTextEntry
          autoCapitalize="none"
        />
        <TextField
          label="Confirmar nueva contraseña"
          value={confirmarNueva}
          onChangeText={setConfirmarNueva}
          secureTextEntry
          autoCapitalize="none"
        />
        <Button title="Cambiar contraseña" onPress={guardar} loading={enviando} />
      </Card>

      {usuario?.rol === 'ADMINISTRADOR' && (
        <Card>
          <ThemedText type="smallBold" themeColor="destructive">
            Zona de peligro
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Borra permanentemente todos los clientes, préstamos y pagos. No se puede deshacer.
          </ThemedText>
          <Button title="Eliminar todos los datos" variant="destructive" onPress={() => setPurgarVisible(true)} />
        </Card>
      )}

      <PurgarDatosModal
        visible={purgarVisible}
        onCancelar={() => setPurgarVisible(false)}
        onExito={(resultado) => {
          setPurgarVisible(false);
          Alert.alert(
            'Listo',
            `Se eliminaron ${resultado.clientes} clientes, ${resultado.prestamos} préstamos y ${resultado.pagos} pagos.`
          );
          router.replace('/');
        }}
      />
    </Screen>
  );
}
