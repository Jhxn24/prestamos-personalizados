import { useCallback, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useCargaEstado } from '@/hooks/use-carga-estado';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { listarPrestamos } from '@/lib/prestamos-api';
import type { Prestamo } from '@/lib/types';

export default function PrestamosListScreen() {
  const { token } = useAuth();
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const { cargando, refrescando, ejecutar } = useCargaEstado();

  const cargar = useCallback(
    (esRefresco = false) =>
      ejecutar(esRefresco, async () => {
        if (!token) return;
        try {
          setPrestamos(await listarPrestamos(token));
        } catch (error) {
          Alert.alert('Error', error instanceof ApiError ? error.message : 'No se pudo cargar la lista de préstamos');
        }
      }),
    [token, ejecutar]
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return prestamos;
    return prestamos.filter((prestamo) =>
      `${prestamo.cliente?.nombre ?? ''} ${prestamo.cliente?.apellido ?? ''}`.toLowerCase().includes(termino)
    );
  }, [prestamos, busqueda]);

  return (
    <Screen cargando={cargando} refrescando={refrescando} onRefrescar={() => cargar(true)}>
      <View style={styles.actionsRow}>
        <Button title="Nuevo préstamo" onPress={() => router.push('/prestamos/nuevo')} />
        <Button title="Ver morosos" variant="secondary" onPress={() => router.push('/prestamos/morosos')} />
      </View>
      <TextField label="Buscar" value={busqueda} onChangeText={setBusqueda} placeholder="Nombre del cliente" />
      {filtrados.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          No hay préstamos que coincidan.
        </ThemedText>
      )}
      {filtrados.map((prestamo) => (
        <Pressable key={prestamo.id} onPress={() => router.push(`/prestamos/${prestamo.id}`)}>
          <Card>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold">
                  {prestamo.cliente ? `${prestamo.cliente.nombre} ${prestamo.cliente.apellido}` : 'Cliente'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  S/ {prestamo.capital} · {prestamo.modalidad.replaceAll('_', ' ').toLowerCase()}
                </ThemedText>
              </View>
              <Badge label={prestamo.estado} variant={prestamo.estado === 'ACTIVO' ? 'default' : 'secondary'} />
            </View>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
