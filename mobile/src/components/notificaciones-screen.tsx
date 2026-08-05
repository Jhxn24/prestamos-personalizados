import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useCargaEstado } from '@/hooks/use-carga-estado';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  listarNotificaciones,
  marcarNotificacionLeida,
  marcarTodasLasNotificacionesLeidas,
} from '@/lib/notificaciones-api';
import type { Notificacion } from '@/lib/types';

function formatearFechaHora(iso: string) {
  return new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
}

/** RF-26/27/28: pantalla de avisos, igual para cliente y administrador (el backend ya filtra por usuario). */
export function NotificacionesScreen() {
  const { token } = useAuth();
  const theme = useTheme();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const { cargando, refrescando, ejecutar } = useCargaEstado();

  const cargar = useCallback(
    (esRefresco = false) =>
      ejecutar(esRefresco, async () => {
        if (!token) return;
        try {
          setNotificaciones(await listarNotificaciones(token));
        } catch (error) {
          Alert.alert('Error', error instanceof ApiError ? error.message : 'No se pudieron cargar tus avisos');
        }
      }),
    [token, ejecutar]
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function alTocar(notificacion: Notificacion) {
    if (notificacion.leida || !token) return;
    setNotificaciones((actual) =>
      actual.map((n) => (n.id === notificacion.id ? { ...n, leida: true } : n))
    );
    try {
      await marcarNotificacionLeida(token, notificacion.id);
    } catch {
      cargar();
    }
  }

  async function marcarTodas() {
    if (!token) return;
    setNotificaciones((actual) => actual.map((n) => ({ ...n, leida: true })));
    try {
      await marcarTodasLasNotificacionesLeidas(token);
    } catch {
      cargar();
    }
  }

  const hayNoLeidas = notificaciones.some((n) => !n.leida);

  return (
    <Screen
      cargando={cargando}
      refrescando={refrescando}
      onRefrescar={() => cargar(true)}
      vacio={notificaciones.length === 0}
      mensajeVacio="No tienes notificaciones.">
      {hayNoLeidas && <Button title="Marcar todas leídas" variant="secondary" onPress={marcarTodas} />}
      {notificaciones.map((notificacion) => (
        <Pressable key={notificacion.id} onPress={() => alTocar(notificacion)}>
          <Card style={!notificacion.leida ? { borderColor: theme.primary } : undefined}>
            <View style={styles.headerRow}>
              {!notificacion.leida && <View style={[styles.dot, { backgroundColor: theme.primary }]} />}
              <ThemedText type="smallBold" style={{ flex: 1 }}>
                {notificacion.titulo}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {notificacion.mensaje}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatearFechaHora(notificacion.createdAt)}
            </ThemedText>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
