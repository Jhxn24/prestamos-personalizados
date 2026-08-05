import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, View } from 'react-native';

import { ClientePickerModal } from '@/components/clientes/cliente-picker-modal';
import { CondicionesFields } from '@/components/prestamos/condiciones-fields';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { listarClientes } from '@/lib/clientes-api';
import {
  CAMPOS_CONDICIONES_INICIALES,
  validarCondiciones,
  type CamposCondiciones,
} from '@/lib/prestamo-form';
import { crearPrestamo, simularPrestamo } from '@/lib/prestamos-api';
import type { Cliente, SimularPrestamoResponse } from '@/lib/types';

function formatearMoneda(valor: string) {
  return `S/ ${valor}`;
}

export default function NuevoPrestamoScreen() {
  const { clienteId: clienteIdInicial } = useLocalSearchParams<{ clienteId?: string }>();
  const { token } = useAuth();

  const [clientesActivos, setClientesActivos] = useState<Cliente[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  const [campos, setCampos] = useState<CamposCondiciones>(CAMPOS_CONDICIONES_INICIALES);
  const [errores, setErrores] = useState<ReturnType<typeof validarCondiciones>['errores']>(null);
  const [resultado, setResultado] = useState<SimularPrestamoResponse | null>(null);
  const [simulando, setSimulando] = useState(false);
  const [registrando, setRegistrando] = useState(false);

  useEffect(() => {
    if (!token) return;
    let activo = true;

    async function cargar() {
      try {
        const clientes = await listarClientes(token!);
        if (!activo) return;
        const activos = clientes.filter((c) => c.activo);
        setClientesActivos(activos);
        if (clienteIdInicial) {
          const preseleccionado = activos.find((c) => c.id === clienteIdInicial);
          if (preseleccionado) setCliente(preseleccionado);
        }
      } catch (error) {
        Alert.alert('Error', error instanceof ApiError ? error.message : 'No se pudo cargar la lista de clientes');
      }
    }

    cargar();
    return () => {
      activo = false;
    };
  }, [token, clienteIdInicial]);

  function actualizarCampo<K extends keyof CamposCondiciones>(campo: K, valor: CamposCondiciones[K]) {
    setCampos((actual) => ({ ...actual, [campo]: valor }));
  }

  async function simular() {
    if (!token) return;
    const { datos, errores: nuevosErrores } = validarCondiciones(campos);
    setErrores(nuevosErrores);
    if (!datos) return;

    setSimulando(true);
    try {
      setResultado(await simularPrestamo(token, datos));
    } catch (error) {
      Alert.alert('No se pudo simular', error instanceof ApiError ? error.message : 'Intenta de nuevo.');
    } finally {
      setSimulando(false);
    }
  }

  async function registrar() {
    if (!token || !cliente) return;
    const { datos } = validarCondiciones(campos);
    if (!datos) return;

    setRegistrando(true);
    try {
      const prestamo = await crearPrestamo(token, { ...datos, clienteId: cliente.id });
      router.replace(`/prestamos/${prestamo.id}`);
    } catch (error) {
      Alert.alert('No se pudo registrar el préstamo', error instanceof ApiError ? error.message : 'Intenta de nuevo.');
    } finally {
      setRegistrando(false);
    }
  }

  return (
    <Screen>
      <Card>
        <ThemedText type="smallBold">Cliente</ThemedText>
        <Button
          title={cliente ? `${cliente.nombre} ${cliente.apellido} — ${cliente.documento}` : 'Elegir cliente'}
          variant="secondary"
          onPress={() => setPickerVisible(true)}
        />
      </Card>

      <Card>
        <ThemedText type="smallBold">Condiciones del préstamo</ThemedText>
        <CondicionesFields campos={campos} errores={errores ?? {}} onCambiar={actualizarCampo} />
        <Button title="Simular cronograma" onPress={simular} loading={simulando} />
      </Card>

      {resultado && (
        <Card>
          <ThemedText type="smallBold">Previsualización</ThemedText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three }}>
            <ThemedText type="small">Total capital: {formatearMoneda(resultado.resumen.totalCapital)}</ThemedText>
            <ThemedText type="small">Total interés: {formatearMoneda(resultado.resumen.totalInteres)}</ThemedText>
            <ThemedText type="small">Total a pagar: {formatearMoneda(resultado.resumen.totalAPagar)}</ThemedText>
          </View>
          {resultado.cuotas.map((cuota) => (
            <View key={cuota.numero} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <ThemedText type="small">
                #{cuota.numero} · {new Date(cuota.fechaVencimiento).toLocaleDateString('es-PE')}
              </ThemedText>
              <ThemedText type="small">{formatearMoneda(cuota.total)}</ThemedText>
            </View>
          ))}
          <Button
            title="Registrar préstamo"
            onPress={registrar}
            loading={registrando}
            disabled={!cliente}
          />
          {!cliente && (
            <ThemedText type="small" themeColor="textSecondary">
              Elige un cliente para poder registrar el préstamo.
            </ThemedText>
          )}
        </Card>
      )}

      <ClientePickerModal
        visible={pickerVisible}
        clientes={clientesActivos}
        onSeleccionar={(seleccionado) => {
          setCliente(seleccionado);
          setPickerVisible(false);
        }}
        onClose={() => setPickerVisible(false)}
      />
    </Screen>
  );
}
