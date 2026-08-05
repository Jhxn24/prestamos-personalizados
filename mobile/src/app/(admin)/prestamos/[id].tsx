import { useCallback, useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Modal, StyleSheet, View } from 'react-native';

import { CondicionesFields } from '@/components/prestamos/condiciones-fields';
import { AnularPagoModal } from '@/components/pagos/anular-pago-modal';
import { RegistrarPagoModal, type DatosRegistrarPago } from '@/components/pagos/registrar-pago-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { anularPago, listarPagos, registrarPago } from '@/lib/pagos-api';
import {
  condicionesDesdeSimularInput,
  validarCondiciones,
  type CamposCondiciones,
  type ErroresCondiciones,
} from '@/lib/prestamo-form';
import { obtenerPrestamo, recalcularPrestamo, refinanciarPrestamo } from '@/lib/prestamos-api';
import type { CuotaPrestamo, Pago, Prestamo } from '@/lib/types';

function formatearMoneda(valor: string) {
  return `S/ ${valor}`;
}

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-PE');
}

const ESTADO_CUOTA_LABEL: Record<CuotaPrestamo['estado'], string> = {
  PENDIENTE: 'Pendiente',
  PARCIAL: 'Parcial',
  PAGADA: 'Pagada',
  VENCIDA: 'Vencida',
};

const ESTADO_PAGO_LABEL: Record<Pago['estado'], string> = {
  CONFIRMADO: 'Confirmado',
  ANULADO: 'Anulado',
  PENDIENTE_CONFIRMACION: 'Pendiente',
  RECHAZADO: 'Rechazado',
};

const MODALIDAD_LABEL: Record<string, string> = {
  INTERES_FIJO: 'Interés fijo',
  INTERES_SOBRE_SALDO: 'Interés sobre saldo',
  CUOTAS_FIJAS: 'Cuotas fijas',
  CAPITAL_AL_FINAL: 'Capital al final',
};

type ModoAjuste = 'recalcular' | 'refinanciar' | null;

export default function PrestamoDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const theme = useTheme();

  const [prestamo, setPrestamo] = useState<Prestamo | null>(null);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [cargando, setCargando] = useState(true);

  const [cuotaAPagar, setCuotaAPagar] = useState<CuotaPrestamo | null>(null);
  const [pagoAAnular, setPagoAAnular] = useState<Pago | null>(null);

  const [modoAjuste, setModoAjuste] = useState<ModoAjuste>(null);
  const [camposAjuste, setCamposAjuste] = useState<CamposCondiciones | null>(null);
  const [erroresAjuste, setErroresAjuste] = useState<ErroresCondiciones>({});
  const [ajustando, setAjustando] = useState(false);

  const cargar = useCallback(async () => {
    if (!token || !id) return;
    try {
      const [respuestaPrestamo, respuestaPagos] = await Promise.all([
        obtenerPrestamo(token, id),
        listarPagos(token, { prestamoId: id }),
      ]);
      setPrestamo(respuestaPrestamo);
      setPagos(respuestaPagos);
    } catch (error) {
      Alert.alert('Error', error instanceof ApiError ? error.message : 'No se pudo cargar el préstamo');
    } finally {
      setCargando(false);
    }
  }, [token, id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function registrarPagoDeCuota(datos: DatosRegistrarPago) {
    if (!token || !cuotaAPagar) return;
    await registrarPago(token, { cuotaId: cuotaAPagar.id, ...datos });
    setCuotaAPagar(null);
    cargar();
  }

  async function anular(motivo: string | undefined) {
    if (!token || !pagoAAnular) return;
    await anularPago(token, pagoAAnular.id, { motivo });
    setPagoAAnular(null);
    cargar();
  }

  function abrirAjuste(modo: 'recalcular' | 'refinanciar') {
    if (!prestamo) return;
    setCamposAjuste(
      condicionesDesdeSimularInput({
        capital: Number(modo === 'refinanciar' ? prestamo.capitalPendiente : prestamo.capital),
        tasaInteres: Number(prestamo.tasaInteres),
        tipoInteres: prestamo.tipoInteres,
        frecuenciaPago: prestamo.frecuenciaPago,
        diasPersonalizados: prestamo.diasPersonalizados ?? undefined,
        numeroCuotas: prestamo.numeroCuotas,
        modalidad: prestamo.modalidad,
        fechaDesembolso: modo === 'refinanciar' ? new Date().toISOString().slice(0, 10) : prestamo.fechaDesembolso,
      })
    );
    setErroresAjuste({});
    setModoAjuste(modo);
  }

  async function confirmarAjuste() {
    if (!token || !prestamo || !camposAjuste || !modoAjuste) return;
    const { datos, errores } = validarCondiciones(camposAjuste);
    setErroresAjuste(errores ?? {});
    if (!datos) return;

    setAjustando(true);
    try {
      const resultado =
        modoAjuste === 'recalcular'
          ? await recalcularPrestamo(token, prestamo.id, datos)
          : await refinanciarPrestamo(token, prestamo.id, datos);
      setModoAjuste(null);
      if (modoAjuste === 'refinanciar') {
        router.replace(`/prestamos/${resultado.id}`);
      } else {
        setPrestamo(resultado);
      }
    } catch (error) {
      Alert.alert('No se pudo completar la operación', error instanceof ApiError ? error.message : 'Intenta de nuevo.');
    } finally {
      setAjustando(false);
    }
  }

  if (cargando || !prestamo) {
    return <Screen cargando />;
  }

  const puedeRecalcular = prestamo.estado === 'ACTIVO' && prestamo.cuotas.every((c) => Number(c.montoPagado) === 0);
  const puedeRefinanciar = prestamo.estado === 'ACTIVO' && Number(prestamo.capitalPendiente) > 0;

  return (
    <Screen>
      <Card>
        <View style={styles.row}>
          <ThemedText type="smallBold">{MODALIDAD_LABEL[prestamo.modalidad] ?? prestamo.modalidad}</ThemedText>
          <Badge label={prestamo.estado} variant={prestamo.estado === 'ACTIVO' ? 'default' : 'secondary'} />
        </View>
        {prestamo.cliente && (
          <ThemedText type="small" themeColor="textSecondary">
            {prestamo.cliente.nombre} {prestamo.cliente.apellido} · {prestamo.cliente.documento}
          </ThemedText>
        )}
        <View style={styles.statsGrid}>
          {[
            ['Capital', formatearMoneda(prestamo.capital)],
            ['Capital pendiente', formatearMoneda(prestamo.capitalPendiente)],
            ['Interés acumulado', formatearMoneda(prestamo.interesAcumulado)],
            ['Mora acumulada', formatearMoneda(prestamo.moraAcumulada)],
            ['Tasa', `${prestamo.tasaInteres}% ${prestamo.tipoInteres.toLowerCase()}`],
            ['Frecuencia', prestamo.frecuenciaPago],
            ['Desembolso', formatearFecha(prestamo.fechaDesembolso)],
          ].map(([label, valor]) => (
            <View key={label} style={styles.statItem}>
              <ThemedText type="small" themeColor="textSecondary">
                {label}
              </ThemedText>
              <ThemedText type="smallBold">{valor}</ThemedText>
            </View>
          ))}
        </View>
        {(puedeRecalcular || puedeRefinanciar) && (
          <View style={styles.actionsRow}>
            {puedeRecalcular && (
              <Button title="Recalcular" variant="secondary" onPress={() => abrirAjuste('recalcular')} />
            )}
            {puedeRefinanciar && (
              <Button title="Refinanciar" variant="secondary" onPress={() => abrirAjuste('refinanciar')} />
            )}
          </View>
        )}
      </Card>

      <Card>
        <ThemedText type="smallBold">Cronograma</ThemedText>
        {prestamo.cuotas.map((cuota) => (
          <View key={cuota.id} style={styles.cuotaRow}>
            <ThemedText type="small" style={{ flex: 1 }}>
              #{cuota.numero} · {formatearFecha(cuota.fechaVencimiento)} · {formatearMoneda(cuota.total)}
            </ThemedText>
            <Badge label={ESTADO_CUOTA_LABEL[cuota.estado]} variant={cuota.estado === 'PAGADA' ? 'success' : 'secondary'} />
            {(cuota.estado === 'PENDIENTE' || cuota.estado === 'PARCIAL' || cuota.estado === 'VENCIDA') && (
              <Button title="Pagar" variant="secondary" onPress={() => setCuotaAPagar(cuota)} />
            )}
          </View>
        ))}
      </Card>

      <Card>
        <ThemedText type="smallBold">Historial de pagos</ThemedText>
        {pagos.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Todavía no hay pagos registrados.
          </ThemedText>
        ) : (
          pagos.map((pago) => (
            <View key={pago.id} style={styles.pagoRow}>
              <View style={{ flex: 1 }}>
                <ThemedText type="small">
                  {formatearMoneda(pago.monto)} · cuota #{pago.cuota?.numero ?? '—'} · {formatearFecha(pago.fechaPago)}
                </ThemedText>
                <Badge
                  label={ESTADO_PAGO_LABEL[pago.estado]}
                  variant={pago.estado === 'CONFIRMADO' ? 'success' : pago.estado === 'ANULADO' ? 'destructive' : 'secondary'}
                />
              </View>
              {pago.estado === 'CONFIRMADO' && (
                <Button title="Anular" variant="destructive" onPress={() => setPagoAAnular(pago)} />
              )}
            </View>
          ))
        )}
      </Card>

      <RegistrarPagoModal
        visible={!!cuotaAPagar}
        titulo={`Registrar pago${cuotaAPagar ? ` — Cuota #${cuotaAPagar.numero}` : ''}`}
        montoInicial={
          cuotaAPagar ? (Number(cuotaAPagar.total) - Number(cuotaAPagar.montoPagado)).toFixed(2) : ''
        }
        textoSubmit="Registrar pago"
        onCancelar={() => setCuotaAPagar(null)}
        onEnviar={registrarPagoDeCuota}
      />

      <AnularPagoModal visible={!!pagoAAnular} onCancelar={() => setPagoAAnular(null)} onEnviar={anular} />

      <Modal visible={!!modoAjuste} animationType="slide" transparent onRequestClose={() => setModoAjuste(null)}>
        <View style={styles.overlay}>
          <ThemedView style={[styles.modalContent, { borderColor: theme.border }]}>
            <Screen>
              <ThemedText type="smallBold">
                {modoAjuste === 'recalcular' ? 'Recalcular préstamo' : 'Refinanciar préstamo'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {modoAjuste === 'recalcular'
                  ? 'Reemplaza el cronograma pendiente. Solo es posible si el préstamo no tiene pagos registrados.'
                  : 'Cierra este préstamo y crea uno nuevo por el saldo pendiente.'}
              </ThemedText>
              {camposAjuste && (
                <CondicionesFields
                  campos={camposAjuste}
                  errores={erroresAjuste}
                  onCambiar={(campo, valor) => setCamposAjuste((actual) => (actual ? { ...actual, [campo]: valor } : actual))}
                />
              )}
              <View style={styles.actionsRow}>
                <Button title="Cancelar" variant="secondary" onPress={() => setModoAjuste(null)} />
                <Button
                  title={modoAjuste === 'recalcular' ? 'Recalcular' : 'Refinanciar'}
                  onPress={confirmarAjuste}
                  loading={ajustando}
                />
              </View>
            </Screen>
          </ThemedView>
        </View>
      </Modal>
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  statItem: {
    minWidth: '40%',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  cuotaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  pagoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    maxHeight: '90%',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
