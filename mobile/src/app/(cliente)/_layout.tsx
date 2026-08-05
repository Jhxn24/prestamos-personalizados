import { Tabs } from 'expo-router';

import { HeaderAccountActions } from '@/components/header-account-actions';
import { useTheme } from '@/hooks/use-theme';

export default function ClienteTabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerRight: () => <HeaderAccountActions />,
        tabBarActiveTintColor: theme.primary,
      }}>
      <Tabs.Screen name="index" options={{ title: 'Mi préstamo' }} />
      <Tabs.Screen name="notificaciones" options={{ title: 'Avisos' }} />
      <Tabs.Screen name="cuenta" options={{ href: null, title: 'Cuenta' }} />
    </Tabs>
  );
}
