import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useCargaEstado } from '@/hooks/use-carga-estado';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { obtenerDashboard } from '@/lib/dashboard-api';
import type { DashboardAdmin } from '@/lib/types';

function formatearMoneda(valor: string) {
  return `S/ ${valor}`;
}

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-PE');
}

/** RF-29: resumen del negocio para el administrador. */
export default function AdminDashboardScreen() {
  const { token } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardAdmin | null>(null);
  const { cargando, refrescando, ejecutar } = useCargaEstado();

  const cargar = useCallback(
    (esRefresco = false) =>
      ejecutar(esRefresco, async () => {
        if (!token) return;
        try {
          setDashboard(await obtenerDashboard<DashboardAdmin>(token));
        } catch (error) {
          Alert.alert('Error', error instanceof ApiError ? error.message : 'No se pudo cargar el resumen');
        }
      }),
    [token, ejecutar]
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!dashboard) {
    return <Screen cargando={cargando} refrescando={refrescando} onRefrescar={() => cargar(true)} />;
  }

  const stats: [string, string][] = [
    ['Total prestado', formatearMoneda(dashboard.totalPrestado)],
    ['Total recuperado', formatearMoneda(dashboard.totalRecuperado)],
    ['Intereses ganados', formatearMoneda(dashboard.interesesGanados)],
    ['Capital pendiente', formatearMoneda(dashboard.capitalPendiente)],
    ['Préstamos activos', String(dashboard.prestamosActivos)],
    ['Clientes activos', String(dashboard.clientesActivos)],
    ['Clientes morosos', String(dashboard.clientesMorosos)],
    ['Préstamos vencidos', String(dashboard.prestamosVencidos)],
  ];

  return (
    <Screen cargando={cargando} refrescando={refrescando} onRefrescar={() => cargar(true)}>
      <View style={styles.statsGrid}>
        {stats.map(([label, valor]) => (
          <Card key={label} style={styles.statCard}>
            <ThemedText type="small" themeColor="textSecondary">
              {label}
            </ThemedText>
            <ThemedText type="smallBold">{valor}</ThemedText>
          </Card>
        ))}
      </View>

      <Card>
        <ThemedText type="smallBold">Flujo de caja</ThemedText>
        <View style={styles.row}>
          <ThemedText type="small" themeColor="textSecondary">
            Hoy
          </ThemedText>
          <ThemedText type="small">{formatearMoneda(dashboard.flujoCaja.hoy)}</ThemedText>
        </View>
        <View style={styles.row}>
          <ThemedText type="small" themeColor="textSecondary">
            Semana
          </ThemedText>
          <ThemedText type="small">{formatearMoneda(dashboard.flujoCaja.semana)}</ThemedText>
        </View>
        <View style={styles.row}>
          <ThemedText type="small" themeColor="textSecondary">
            Mes
          </ThemedText>
          <ThemedText type="small">{formatearMoneda(dashboard.flujoCaja.mes)}</ThemedText>
        </View>
      </Card>

      {dashboard.proximosCobros.length > 0 && (
        <Card>
          <ThemedText type="smallBold">Próximos cobros (7 días)</ThemedText>
          {dashboard.proximosCobros.map((cobro) => (
            <View key={cobro.cuotaId} style={styles.row}>
              <ThemedText type="small" style={{ flex: 1 }}>
                {cobro.cliente} · cuota #{cobro.numeroCuota} · {formatearFecha(cobro.fechaVencimiento)}
              </ThemedText>
              <ThemedText type="smallBold">{formatearMoneda(cobro.montoPendiente)}</ThemedText>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  statCard: {
    flexBasis: '45%',
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
});
