import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AnularPagoModal } from '@/components/pagos/anular-pago-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useCargaEstado } from '@/hooks/use-carga-estado';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { anularPago, listarPagos } from '@/lib/pagos-api';
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

const ESTADO_PAGO_LABEL: Record<Pago['estado'], string> = {
  CONFIRMADO: 'Confirmado',
  ANULADO: 'Anulado',
  PENDIENTE_CONFIRMACION: 'Pendiente',
  RECHAZADO: 'Rechazado',
};

/** Lista de pagos marcados por el administrador (RF-25), con opción de anular. */
export default function PagosScreen() {
  const { token } = useAuth();

  const [pagos, setPagos] = useState<Pago[]>([]);
  const { cargando, refrescando, ejecutar } = useCargaEstado();
  const [pagoAAnular, setPagoAAnular] = useState<Pago | null>(null);

  const cargar = useCallback(
    (esRefresco = false) =>
      ejecutar(esRefresco, async () => {
        if (!token) return;
        try {
          setPagos(await listarPagos(token));
        } catch (error) {
          Alert.alert('Error', error instanceof ApiError ? error.message : 'No se pudieron cargar los pagos');
        }
      }),
    [token, ejecutar]
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function anular(motivo: string | undefined) {
    if (!token || !pagoAAnular) return;
    const actualizado = await anularPago(token, pagoAAnular.id, { motivo });
    setPagos((actual) => actual.map((p) => (p.id === actualizado.id ? actualizado : p)));
    setPagoAAnular(null);
  }

  return (
    <Screen
      cargando={cargando}
      refrescando={refrescando}
      onRefrescar={() => cargar(true)}
      vacio={pagos.length === 0}
      mensajeVacio="Todavía no hay pagos registrados.">
      {pagos.map((pago) => (
        <Card key={pago.id}>
          <View style={styles.headerRow}>
            <ThemedText type="smallBold">
              {pago.cuota ? `Cuota #${pago.cuota.numero}` : 'Sin cuota'} · {formatearMoneda(pago.monto)}
            </ThemedText>
            <Badge
              label={ESTADO_PAGO_LABEL[pago.estado]}
              variant={pago.estado === 'CONFIRMADO' ? 'success' : pago.estado === 'ANULADO' ? 'destructive' : 'secondary'}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {formatearFecha(pago.fechaPago)} · {METODO_LABEL[pago.metodo] ?? pago.metodo}
            {pago.observaciones ? ` · ${pago.observaciones}` : ''}
          </ThemedText>
          {pago.estado === 'CONFIRMADO' && (
            <View style={styles.actions}>
              <Button title="Anular" variant="destructive" onPress={() => setPagoAAnular(pago)} />
            </View>
          )}
        </Card>
      ))}

      <AnularPagoModal visible={!!pagoAAnular} onCancelar={() => setPagoAAnular(null)} onEnviar={anular} />
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
