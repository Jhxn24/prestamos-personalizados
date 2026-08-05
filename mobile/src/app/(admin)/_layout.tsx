import { Tabs } from 'expo-router';

import { HeaderAccountActions } from '@/components/header-account-actions';
import { useTheme } from '@/hooks/use-theme';

export default function AdminTabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerRight: () => <HeaderAccountActions />,
        tabBarActiveTintColor: theme.primary,
      }}>
      <Tabs.Screen name="index" options={{ title: 'Resumen' }} />
      <Tabs.Screen name="clientes" options={{ title: 'Clientes', headerShown: false }} />
      <Tabs.Screen name="prestamos" options={{ title: 'Préstamos', headerShown: false }} />
      <Tabs.Screen name="pagos-pendientes" options={{ title: 'Pagos' }} />
      <Tabs.Screen name="notificaciones" options={{ title: 'Avisos' }} />
      <Tabs.Screen name="cuenta" options={{ href: null, title: 'Cuenta' }} />
    </Tabs>
  );
}
