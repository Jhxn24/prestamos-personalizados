import { Stack } from 'expo-router';

import { HeaderAccountActions } from '@/components/header-account-actions';

export default function ClientesStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Clientes', headerRight: () => <HeaderAccountActions /> }} />
      <Stack.Screen name="nuevo" options={{ title: 'Nuevo cliente' }} />
      <Stack.Screen name="[id]" options={{ title: 'Cliente' }} />
    </Stack>
  );
}
