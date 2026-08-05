import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useCargaEstado } from '@/hooks/use-carga-estado';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { obtenerDashboard } from '@/lib/dashboard-api';
import { listarPagos } from '@/lib/pagos-api';
import type { DashboardCliente, EstadoCuota, Pago } from '@/lib/types';

function formatearMoneda(valor: string) {
  return `S/ ${valor}`;
}

function formatearFecha(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('es-PE') : '—';
}

const ESTADO_CUOTA_LABEL: Record<EstadoCuota, string> = {
  PENDIENTE: 'Pendiente',
  PARCIAL: 'Parcial',
  PAGADA: 'Pagada',
  VENCIDA: 'Vencida',
};

const ESTADO_PAGO_LABEL: Record<string, string> = {
  PENDIENTE_CONFIRMACION: 'Pendiente de confirmación',
  RECHAZADO: 'Rechazado',
};

/** RF-30: dashboard del cliente. Mismo criterio que frontend/cliente-dashboard.tsx. */
export default function ClienteDashboardScreen() {
  const { token } = useAuth();
  const [prestamos, setPrestamos] = useState<DashboardCliente | null>(null);
  const [pagosNoConfirmados, setPagosNoConfirmados] = useState<Record<string, Pago[]>>({});
  const { cargando, refrescando, ejecutar } = useCargaEstado();

  const cargar = useCallback(
    (esRefresco = false) =>
      ejecutar(esRefresco, async () => {
        if (!token) return;
        try {
          const [dashboard, pagos] = await Promise.all([
            obtenerDashboard<DashboardCliente>(token),
            listarPagos(token),
          ]);
          setPrestamos(dashboard);
          setPagosNoConfirmados(
            pagos
              .filter((pago) => pago.estado !== 'CONFIRMADO')
              .reduce<Record<string, Pago[]>>((acumulado, pago) => {
                (acumulado[pago.prestamoId] ??= []).push(pago);
                return acumulado;
              }, {})
          );
        } catch (error) {
          Alert.alert('Error', error instanceof ApiError ? error.message : 'No se pudo cargar tu préstamo');
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
      vacio={!!prestamos && prestamos.length === 0}
      mensajeVacio="Todavía no tienes préstamos registrados.">
      {prestamos?.map((prestamo) => (
        <Card key={prestamo.id}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold">
                Préstamo {prestamo.modalidad.replaceAll('_', ' ').toLowerCase()}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Próximo pago: {formatearFecha(prestamo.proximaFechaPago)}
                {prestamo.proximoMonto ? ` · ${formatearMoneda(prestamo.proximoMonto)}` : ''}
              </ThemedText>
            </View>
            <Badge label={prestamo.estado} variant={prestamo.estado === 'ACTIVO' ? 'default' : 'secondary'} />
          </View>

          <View style={styles.statsGrid}>
            {[
              ['Capital', prestamo.capital],
              ['Capital pendiente', prestamo.capitalPendiente],
              ['Interés pendiente', prestamo.interesPendiente],
              ['Mora acumulada', prestamo.moraAcumulada],
            ].map(([label, valor]) => (
              <View key={label} style={styles.statItem}>
                <ThemedText type="small" themeColor="textSecondary">
                  {label}
                </ThemedText>
                <ThemedText type="smallBold">{formatearMoneda(valor)}</ThemedText>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold">Cronograma</ThemedText>
            {prestamo.cronograma.map((cuota) => (
              <View key={cuota.numero} style={styles.row}>
                <ThemedText type="small" style={styles.rowLabel}>
                  #{cuota.numero} · {formatearFecha(cuota.fechaVencimiento)}
                </ThemedText>
                <ThemedText type="small">{formatearMoneda(cuota.total)}</ThemedText>
                <Badge label={ESTADO_CUOTA_LABEL[cuota.estado]} variant={cuota.estado === 'PAGADA' ? 'success' : 'secondary'} />
              </View>
            ))}
          </View>

          {(pagosNoConfirmados[prestamo.id]?.length ?? 0) > 0 && (
            <View style={styles.section}>
              <ThemedText type="smallBold">Pagos pendientes</ThemedText>
              {pagosNoConfirmados[prestamo.id].map((pago) => (
                <View key={pago.id} style={styles.row}>
                  <ThemedText type="small" style={styles.rowLabel}>
                    {formatearFecha(pago.fechaPago)} · {formatearMoneda(pago.monto)}
                  </ThemedText>
                  <Badge
                    label={ESTADO_PAGO_LABEL[pago.estado] ?? pago.estado}
                    variant={pago.estado === 'RECHAZADO' ? 'destructive' : 'secondary'}
                  />
                </View>
              ))}
            </View>
          )}

          {prestamo.historialPagos.length > 0 && (
            <View style={styles.section}>
              <ThemedText type="smallBold">Historial de pagos</ThemedText>
              {prestamo.historialPagos.map((pago) => (
                <View key={pago.id} style={styles.row}>
                  <ThemedText type="small" style={styles.rowLabel}>
                    {formatearFecha(pago.fecha)} · {pago.metodo}
                  </ThemedText>
                  <ThemedText type="small">{formatearMoneda(pago.monto)}</ThemedText>
                </View>
              ))}
            </View>
          )}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  statItem: {
    minWidth: '40%',
  },
  section: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: 2,
  },
  rowLabel: {
    flex: 1,
  },
});
