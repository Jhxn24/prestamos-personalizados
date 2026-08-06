import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

import { apiFetch } from './api';

// Cómo se muestra un push si llega con la app abierta (en primer plano).
// Con la app cerrada o en segundo plano, el sistema operativo lo muestra solo.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Pide permiso de notificaciones y registra el token de este dispositivo
 * contra el backend, para que RF-26/27/28 lleguen como push de verdad
 * aunque la app esté cerrada. Se llama después de loguear o al restaurar
 * una sesión guardada (ver AuthProvider).
 *
 * Deliberadamente silenciosa ante cualquier falla (emulador sin Google Play
 * Services, permiso denegado, backend caído un instante, o —antes de
 * configurar Firebase/EAS— la propia llamada a Expo fallando): nunca debe
 * romper el login ni molestar al usuario con un error que no puede resolver
 * desde la app.
 */
export async function registrarPushToken(authToken: string) {
  try {
    // Los simuladores/emuladores no tienen push real.
    if (!Device.isDevice) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'General',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const permisoActual = await Notifications.getPermissionsAsync();
    let estado = permisoActual.status;
    if (estado !== 'granted') {
      const solicitado = await Notifications.requestPermissionsAsync();
      estado = solicitado.status;
    }
    if (estado !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    await apiFetch('/api/notificaciones/push-token', {
      token: authToken,
      method: 'POST',
      body: JSON.stringify({ token: expoPushToken }),
    });
  } catch {
    // best-effort, ver comentario de arriba.
  }
}
