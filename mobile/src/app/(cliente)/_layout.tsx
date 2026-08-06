import { Tabs } from 'expo-router';

import { HeaderAccountActions } from '@/components/header-account-actions';
import { useTheme } from '@/hooks/use-theme';
import { tabBarIcon } from '@/lib/tab-icons';

export default function ClienteTabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerRight: () => <HeaderAccountActions />,
        tabBarActiveTintColor: theme.primary,
      }}>
      <Tabs.Screen name="index" options={{ title: 'Mi préstamo', tabBarIcon: tabBarIcon('wallet') }} />
      <Tabs.Screen
        name="notificaciones"
        options={{ title: 'Avisos', tabBarIcon: tabBarIcon('notifications') }}
      />
      <Tabs.Screen name="cuenta" options={{ href: null, title: 'Cuenta' }} />
    </Tabs>
  );
}
