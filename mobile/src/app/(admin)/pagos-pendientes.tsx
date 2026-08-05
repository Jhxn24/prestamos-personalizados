import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { RechazarPagoModal } from '@/components/pagos/rechazar-pago-modal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useCargaEstado } from '@/hooks/use-carga-estado';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { confirmarPago, listarPagos, rechazarPago } from '@/lib/pagos-api';
import type { Pago } from '@/lib/types';

function formatearMoneda(valor: string) {
  return `S/ ${valor}`;
}

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-PE');
}

const METODO_LABEL: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  DEPOSITO: 'Depósito',
  YAPE_PLIN: 'Yape/Plin',
  OTRO: 'Otro',
};

/** RF-23: el administrador confirma o rechaza pagos reportados por el cliente. */
export default function PagosPendientesScreen() {
  const { token } = useAuth();

  const [pagos, setPagos] = useState<Pago[]>([]);
  const { cargando, refrescando, ejecutar } = useCargaEstado();
  const [procesando, setProcesando] = useState<string | null>(null);
  const [pagoARechazar, setPagoARechazar] = useState<Pago | null>(null);

  const cargar = useCallback(
    (esRefresco = false) =>
      ejecutar(esRefresco, async () => {
        if (!token) return;
        try {
          setPagos(await listarPagos(token, { estado: 'PENDIENTE_CONFIRMACION' }));
        } catch (error) {
          Alert.alert('Error', error instanceof ApiError ? error.message : 'No se pudieron cargar los pagos pendientes');
        }
      }),
    [token, ejecutar]
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function confirmar(pago: Pago) {
    if (!token) return;
    setProcesando(pago.id);
    try {
      await confirmarPago(token, pago.id);
      setPagos((actual) => actual.filter((p) => p.id !== pago.id));
    } catch (error) {
      Alert.alert('No se pudo confirmar', error instanceof ApiError ? error.message : 'Intenta de nuevo.');
    } finally {
      setProcesando(null);
    }
  }

  async function confirmarRechazo(motivoRechazo: string | undefined) {
    if (!token || !pagoARechazar) return;
    await rechazarPago(token, pagoARechazar.id, motivoRechazo);
    setPagos((actual) => actual.filter((p) => p.id !== pagoARechazar.id));
    setPagoARechazar(null);
  }

  return (
    <Screen
      cargando={cargando}
      refrescando={refrescando}
      onRefrescar={() => cargar(true)}
      vacio={pagos.length === 0}
      mensajeVacio="No hay pagos pendientes de confirmar.">
      {pagos.map((pago) => (
        <Card key={pago.id}>
          <View style={styles.headerRow}>
            <ThemedText type="smallBold">
              {pago.cuota ? `Cuota #${pago.cuota.numero}` : 'Sin cuota'} · {formatearMoneda(pago.monto)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatearFecha(pago.fechaPago)}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {METODO_LABEL[pago.metodo] ?? pago.metodo}
            {pago.observaciones ? ` · ${pago.observaciones}` : ''}
          </ThemedText>
          {pago.comprobanteUrl && (
            <ThemedText type="small" themeColor="primary">
              {pago.comprobanteUrl}
            </ThemedText>
          )}
          <View style={styles.actions}>
            <Button
              title="Rechazar"
              variant="destructive"
              onPress={() => setPagoARechazar(pago)}
              loading={procesando === pago.id}
            />
            <Button title="Confirmar" onPress={() => confirmar(pago)} loading={procesando === pago.id} />
          </View>
        </Card>
      ))}

      <RechazarPagoModal
        visible={!!pagoARechazar}
        onCancelar={() => setPagoARechazar(null)}
        onEnviar={confirmarRechazo}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'flex-end',
  },
});
