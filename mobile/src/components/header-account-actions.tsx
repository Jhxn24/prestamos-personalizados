import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { HeaderLogoutButton } from '@/components/header-logout-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/** "Cuenta" (cambiar contraseña) + "Salir" — usado como headerRight en todos los layouts. */
export function HeaderAccountActions() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
      <Pressable onPress={() => router.push('/cuenta')} hitSlop={12}>
        <ThemedText type="link" themeColor="primary">
          Cuenta
        </ThemedText>
      </Pressable>
      <HeaderLogoutButton />
    </View>
  );
}
