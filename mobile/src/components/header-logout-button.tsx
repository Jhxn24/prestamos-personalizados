import { Alert, Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth';

export function HeaderLogoutButton() {
  const { logout } = useAuth();

  function confirmar() {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: logout },
    ]);
  }

  return (
    <Pressable onPress={confirmar} hitSlop={12} style={{ marginRight: 16 }}>
      <ThemedText type="link" themeColor="primary">
        Salir
      </ThemedText>
    </Pressable>
  );
}
