import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { RegistrarPagoModal, type DatosRegistrarPago } from '@/components/pagos/registrar-pago-modal';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useCargaEstado } from '@/hooks/use-carga-estado';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { listarPagos, registrarPago } from '@/lib/pagos-api';
import { listarPrestamos } from '@/lib/prestamos-api';
import type { CuotaPrestamo, EstadoPago, Pago } from '@/lib/types';

function formatearMoneda(valor: string) {
  return `S/ ${valor}`;
}

function formatearFecha(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('es-PE') : '—';
}

const ESTADO_PAGO_LABEL: Record<EstadoPago, string> = {
  PENDIENTE_CONFIRMACION: 'Pendiente de confirmación',
  CONFIRMADO: 'Confirmado',
  RECHAZADO: 'Rechazado',
};

interface CuotaSeleccionable extends CuotaPrestamo {
  prestamoId: string;
  montoPendiente: string;
}

export default function PagosClienteScreen() {
  const { token } = useAuth();

  const [cuotasPendientes, setCuotasPendientes] = useState<CuotaSeleccionable[]>([]);
  const [historial, setHistorial] = useState<Pago[]>([]);
  const { cargando, refrescando, ejecutar } = useCargaEstado();

  const [cuotaSeleccionada, setCuotaSeleccionada] = useState<CuotaSeleccionable | null>(null);

  const cargar = useCallback(
    (esRefresco = false) =>
      ejecutar(esRefresco, async () => {
        if (!token) return;
        try {
          const [prestamos, pagos] = await Promise.all([listarPrestamos(token), listarPagos(token)]);

          const pendientes: CuotaSeleccionable[] = [];
          for (const prestamo of prestamos) {
            if (prestamo.estado !== 'ACTIVO') continue;
            for (const cuota of prestamo.cuotas) {
              if (cuota.estado === 'PENDIENTE' || cuota.estado === 'PARCIAL') {
                pendientes.push({
                  ...cuota,
                  prestamoId: prestamo.id,
                  montoPendiente: (Number(cuota.total) - Number(cuota.montoPagado)).toFixed(2),
                });
              }
            }
          }
          setCuotasPendientes(pendientes);
          setHistorial(pagos.sort((a, b) => (a.fechaPago < b.fechaPago ? 1 : -1)));
        } catch (error) {
          Alert.alert('Error', error instanceof ApiError ? error.message : 'No se pudo cargar tus pagos');
        }
      }),
    [token, ejecutar]
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function reportarPago(datos: DatosRegistrarPago) {
    if (!token || !cuotaSeleccionada) return;
    await registrarPago(token, { cuotaId: cuotaSeleccionada.id, ...datos });
    Alert.alert('Listo', 'Reportaste tu pago, queda pendiente de confirmación.');
    setCuotaSeleccionada(null);
    cargar(true);
  }

  return (
    <Screen cargando={cargando} refrescando={refrescando} onRefrescar={() => cargar(true)}>
      {cuotasPendientes.length > 0 && (
        <Card>
          <ThemedText type="smallBold">Cuotas por pagar</ThemedText>
          {cuotasPendientes.map((cuota) => (
            <Pressable
              key={`${cuota.prestamoId}-${cuota.numero}`}
              onPress={() => setCuotaSeleccionada(cuota)}
              style={styles.row}>
              <ThemedText type="small" style={{ flex: 1 }}>
                #{cuota.numero} · {formatearFecha(cuota.fechaVencimiento)}
              </ThemedText>
              <ThemedText type="smallBold">{formatearMoneda(cuota.montoPendiente)}</ThemedText>
            </Pressable>
          ))}
        </Card>
      )}

      <Card>
        <ThemedText type="smallBold">Historial de pagos</ThemedText>
        {historial.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Todavía no reportaste pagos.
          </ThemedText>
        ) : (
          historial.map((pago) => (
            <View key={pago.id} style={styles.historialRow}>
              <View style={{ flex: 1 }}>
                <ThemedText type="small">
                  {formatearFecha(pago.fechaPago)} · {formatearMoneda(pago.monto)}
                </ThemedText>
                {pago.estado === 'RECHAZADO' && pago.motivoRechazo && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {pago.motivoRechazo}
                  </ThemedText>
                )}
              </View>
              <Badge
                label={ESTADO_PAGO_LABEL[pago.estado]}
                variant={
                  pago.estado === 'CONFIRMADO'
                    ? 'success'
                    : pago.estado === 'RECHAZADO'
                      ? 'destructive'
                      : 'secondary'
                }
              />
            </View>
          ))
        )}
      </Card>

      <RegistrarPagoModal
        visible={!!cuotaSeleccionada}
        titulo={`Reportar pago${cuotaSeleccionada ? ` — Cuota #${cuotaSeleccionada.numero}` : ''}`}
        montoInicial={cuotaSeleccionada?.montoPendiente ?? ''}
        textoSubmit="Reportar pago"
        onCancelar={() => setCuotaSeleccionada(null)}
        onEnviar={reportarPago}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  historialRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
});
