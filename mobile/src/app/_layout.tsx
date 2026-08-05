import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import * as SplashScreen from 'expo-splash-screen';

import { ThemedView } from '@/components/themed-view';
import { AuthProvider, useAuth } from '@/lib/auth';

SplashScreen.preventAutoHideAsync();

/**
 * Rutas protegidas por sesión y por rol (RNF-05): mientras se restaura la
 * sesión guardada no se decide nada; ya resuelta, Stack.Protected muestra
 * exactamente una rama según haya o no usuario, y según su rol.
 */
function RootNavigator() {
  const { usuario, cargando } = useAuth();

  useEffect(() => {
    if (!cargando) {
      SplashScreen.hideAsync();
    }
  }, [cargando]);

  if (cargando) {
    return <ThemedView style={{ flex: 1 }} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!usuario}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={usuario?.rol === 'CLIENTE'}>
        <Stack.Screen name="(cliente)" />
      </Stack.Protected>
      <Stack.Protected guard={usuario?.rol === 'ADMINISTRADOR'}>
        <Stack.Screen name="(admin)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}
