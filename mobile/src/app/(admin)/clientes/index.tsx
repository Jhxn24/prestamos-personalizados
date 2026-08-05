import { useCallback, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useCargaEstado } from '@/hooks/use-carga-estado';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { listarClientes } from '@/lib/clientes-api';
import type { Cliente } from '@/lib/types';

export default function ClientesListScreen() {
  const { token } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const { cargando, refrescando, ejecutar } = useCargaEstado();

  const cargar = useCallback(
    (esRefresco = false) =>
      ejecutar(esRefresco, async () => {
        if (!token) return;
        try {
          setClientes(await listarClientes(token));
        } catch (error) {
          Alert.alert('Error', error instanceof ApiError ? error.message : 'No se pudo cargar la lista de clientes');
        }
      }),
    [token, ejecutar]
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return clientes;
    return clientes.filter((cliente) =>
      `${cliente.nombre} ${cliente.apellido} ${cliente.documento} ${cliente.email ?? ''}`
        .toLowerCase()
        .includes(termino)
    );
  }, [clientes, busqueda]);

  return (
    <Screen cargando={cargando} refrescando={refrescando} onRefrescar={() => cargar(true)}>
      <Button title="Nuevo cliente" onPress={() => router.push('/clientes/nuevo')} />
      <TextField
        label="Buscar"
        value={busqueda}
        onChangeText={setBusqueda}
        placeholder="Nombre, documento o email"
      />
      {filtrados.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          No hay clientes que coincidan.
        </ThemedText>
      )}
      {filtrados.map((cliente) => (
        <Pressable key={cliente.id} onPress={() => router.push(`/clientes/${cliente.id}`)}>
          <Card>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold">
                  {cliente.nombre} {cliente.apellido}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {cliente.documento}
                  {cliente.tieneAcceso ? ` · ${cliente.email}` : ' · Sin acceso'}
                </ThemedText>
              </View>
              <Badge label={cliente.activo ? 'Activo' : 'Inactivo'} variant={cliente.activo ? 'default' : 'secondary'} />
            </View>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
