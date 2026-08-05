import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { useCargaEstado } from '@/hooks/use-carga-estado';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { listarPrestamos } from '@/lib/prestamos-api';
import type { Prestamo } from '@/lib/types';

function formatearMoneda(valor: number) {
  return `S/ ${valor.toFixed(2)}`;
}

/** Mismo criterio que dashboard.service.js / frontend/columnas-morosos.tsx: cuotas VENCIDA de un préstamo ACTIVO. */
function cuotasVencidas(prestamo: Prestamo) {
  return prestamo.cuotas.filter((cuota) => cuota.estado === 'VENCIDA');
}

function esMoroso(prestamo: Prestamo) {
  return prestamo.estado === 'ACTIVO' && cuotasVencidas(prestamo).length > 0;
}

function diasAtrasoMaximo(prestamo: Prestamo) {
  return cuotasVencidas(prestamo).reduce((max, cuota) => Math.max(max, cuota.diasAtraso), 0);
}

function montoVencido(prestamo: Prestamo) {
  return cuotasVencidas(prestamo).reduce(
    (total, cuota) => total + (Number(cuota.total) - Number(cuota.montoPagado)),
    0
  );
}

export default function MorososScreen() {
  const { token } = useAuth();
  const [morosos, setMorosos] = useState<Prestamo[]>([]);
  const { cargando, refrescando, ejecutar } = useCargaEstado();

  const cargar = useCallback(
    (esRefresco = false) =>
      ejecutar(esRefresco, async () => {
        if (!token) return;
        try {
          const prestamos = await listarPrestamos(token);
          setMorosos(prestamos.filter(esMoroso));
        } catch (error) {
          Alert.alert('Error', error instanceof ApiError ? error.message : 'No se pudo cargar la lista de morosos');
        }
      }),
    [token, ejecutar]
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <Screen
      cargando={cargando}
      refrescando={refrescando}
      onRefrescar={() => cargar(true)}
      vacio={morosos.length === 0}
      mensajeVacio="No hay clientes morosos.">
      {morosos.map((prestamo) => (
        <Pressable key={prestamo.id} onPress={() => router.push(`/prestamos/${prestamo.id}`)}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <ThemedText type="smallBold">
                {prestamo.cliente ? `${prestamo.cliente.nombre} ${prestamo.cliente.apellido}` : 'Cliente'}
              </ThemedText>
              <Badge label={`${diasAtrasoMaximo(prestamo)} días`} variant="destructive" />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {cuotasVencidas(prestamo).length} cuota(s) vencida(s) · {formatearMoneda(montoVencido(prestamo))}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Mora acumulada: S/ {prestamo.moraAcumulada}
            </ThemedText>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
