import { Stack } from 'expo-router';

import { HeaderAccountActions } from '@/components/header-account-actions';

export default function PrestamosStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Préstamos', headerRight: () => <HeaderAccountActions /> }} />
      <Stack.Screen name="nuevo" options={{ title: 'Nuevo préstamo' }} />
      <Stack.Screen name="[id]" options={{ title: 'Préstamo' }} />
      <Stack.Screen name="morosos" options={{ title: 'Morosos' }} />
    </Stack>
  );
}
