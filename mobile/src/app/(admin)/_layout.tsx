import { Tabs } from 'expo-router';

import { HeaderAccountActions } from '@/components/header-account-actions';
import { useTheme } from '@/hooks/use-theme';
import { tabBarIcon } from '@/lib/tab-icons';

export default function AdminTabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerRight: () => <HeaderAccountActions />,
        tabBarActiveTintColor: theme.primary,
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Resumen', tabBarIcon: tabBarIcon('stats-chart') }}
      />
      <Tabs.Screen
        name="clientes"
        options={{ title: 'Clientes', headerShown: false, tabBarIcon: tabBarIcon('people') }}
      />
      <Tabs.Screen
        name="prestamos"
        options={{ title: 'Préstamos', headerShown: false, tabBarIcon: tabBarIcon('cash') }}
      />
      <Tabs.Screen name="pagos" options={{ title: 'Pagos', tabBarIcon: tabBarIcon('card') }} />
      <Tabs.Screen
        name="notificaciones"
        options={{ title: 'Avisos', tabBarIcon: tabBarIcon('notifications') }}
      />
      <Tabs.Screen name="cuenta" options={{ href: null, title: 'Cuenta' }} />
    </Tabs>
  );
}
