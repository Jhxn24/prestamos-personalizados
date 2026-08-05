import { useCallback, useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { GenerarAccesoModal } from '@/components/clientes/generar-acceso-modal';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { actualizarCliente, desactivarCliente, generarAccesoCliente, obtenerCliente } from '@/lib/clientes-api';
import { listarPrestamos } from '@/lib/prestamos-api';
import type { Cliente, Prestamo } from '@/lib/types';

interface CamposEdicion {
  nombre: string;
  apellido: string;
  documento: string;
  telefono: string;
  direccion: string;
}

function camposDe(cliente: Cliente): CamposEdicion {
  return {
    nombre: cliente.nombre,
    apellido: cliente.apellido,
    documento: cliente.documento,
    telefono: cliente.telefono ?? '',
    direccion: cliente.direccion ?? '',
  };
}

export default function ClienteDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [campos, setCampos] = useState<CamposEdicion | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [desactivando, setDesactivando] = useState(false);
  const [generarAccesoVisible, setGenerarAccesoVisible] = useState(false);

  useEffect(() => {
    if (!token || !id) return;
    let activo = true;

    async function cargar() {
      setCargando(true);
      try {
        const [respuestaCliente, respuestaPrestamos] = await Promise.all([
          obtenerCliente(token!, id!),
          listarPrestamos(token!),
        ]);
        if (!activo) return;
        setCliente(respuestaCliente);
        setPrestamos(respuestaPrestamos.filter((p) => p.cliente?.id === id));
      } catch (error) {
        Alert.alert('Error', error instanceof ApiError ? error.message : 'No se pudo cargar el cliente');
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargar();
    return () => {
      activo = false;
    };
  }, [token, id]);

  function abrirEdicion() {
    if (!cliente) return;
    setCampos(camposDe(cliente));
    setEditando(true);
  }

  const actualizarCampo = useCallback(
    <K extends keyof CamposEdicion>(campo: K, valor: CamposEdicion[K]) => {
      setCampos((actual) => (actual ? { ...actual, [campo]: valor } : actual));
    },
    []
  );

  async function guardar() {
    if (!token || !cliente || !campos) return;
    if (!campos.nombre.trim() || !campos.apellido.trim() || !campos.documento.trim()) {
      Alert.alert('Faltan datos', 'Nombre, apellido y documento son obligatorios.');
      return;
    }
    setGuardando(true);
    try {
      const actualizado = await actualizarCliente(token, cliente.id, {
        nombre: campos.nombre.trim(),
        apellido: campos.apellido.trim(),
        documento: campos.documento.trim(),
        telefono: campos.telefono.trim(),
        direccion: campos.direccion.trim(),
      });
      setCliente(actualizado);
      setEditando(false);
    } catch (error) {
      Alert.alert('No se pudo guardar', error instanceof ApiError ? error.message : 'Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  function confirmarDesactivar() {
    if (!cliente) return;
    Alert.alert(
      `¿Desactivar a ${cliente.nombre} ${cliente.apellido}?`,
      cliente.tieneAcceso
        ? 'El cliente y su cuenta de acceso quedarán inactivos. No hay una acción para reactivarlo desde aquí.'
        : 'El cliente quedará inactivo. No hay una acción para reactivarlo desde aquí.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desactivar', style: 'destructive', onPress: desactivar },
      ]
    );
  }

  async function desactivar() {
    if (!token || !cliente) return;
    setDesactivando(true);
    try {
      setCliente(await desactivarCliente(token, cliente.id));
    } catch (error) {
      Alert.alert('No se pudo desactivar', error instanceof ApiError ? error.message : 'Intenta de nuevo.');
    } finally {
      setDesactivando(false);
    }
  }

  async function generarAcceso(email: string, password: string) {
    if (!token || !cliente) return;
    const actualizado = await generarAccesoCliente(token, cliente.id, { email, password });
    setCliente(actualizado);
    setGenerarAccesoVisible(false);
  }

  const puedeRegistrarPrestamo = useMemo(() => cliente?.activo ?? false, [cliente]);

  if (cargando || !cliente) {
    return <Screen cargando />;
  }

  return (
    <Screen>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <ThemedText type="smallBold">
            {cliente.nombre} {cliente.apellido}
          </ThemedText>
          <Badge label={cliente.activo ? 'Activo' : 'Inactivo'} variant={cliente.activo ? 'default' : 'secondary'} />
        </View>

        {editando && campos ? (
          <>
            <TextField label="Nombre" value={campos.nombre} onChangeText={(v) => actualizarCampo('nombre', v)} />
            <TextField label="Apellido" value={campos.apellido} onChangeText={(v) => actualizarCampo('apellido', v)} />
            <TextField label="Documento" value={campos.documento} onChangeText={(v) => actualizarCampo('documento', v)} />
            <TextField label="Teléfono" value={campos.telefono} onChangeText={(v) => actualizarCampo('telefono', v)} />
            <TextField label="Dirección" value={campos.direccion} onChangeText={(v) => actualizarCampo('direccion', v)} />
            <View style={{ flexDirection: 'row', gap: Spacing.two, justifyContent: 'flex-end' }}>
              <Button title="Cancelar" variant="secondary" onPress={() => setEditando(false)} />
              <Button title="Guardar" onPress={guardar} loading={guardando} />
            </View>
          </>
        ) : (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Documento: {cliente.documento}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Teléfono: {cliente.telefono ?? '—'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {cliente.tieneAcceso ? `Email: ${cliente.email}` : 'Sin acceso a la app'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Dirección: {cliente.direccion ?? '—'}
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' }}>
              <Button title="Editar" variant="secondary" onPress={abrirEdicion} />
              <Button
                title="Desactivar"
                variant="destructive"
                disabled={!cliente.activo || desactivando}
                onPress={confirmarDesactivar}
              />
              {!cliente.tieneAcceso && (
                <Button title="Generar acceso" variant="secondary" onPress={() => setGenerarAccesoVisible(true)} />
              )}
              {puedeRegistrarPrestamo && (
                <Button
                  title="Registrar préstamo"
                  variant="secondary"
                  onPress={() => router.push(`/prestamos/nuevo?clienteId=${cliente.id}`)}
                />
              )}
            </View>
          </>
        )}
      </Card>

      {prestamos.length > 0 && (
        <Card>
          <ThemedText type="smallBold">Préstamos</ThemedText>
          {prestamos.map((prestamo) => (
            <Pressable key={prestamo.id} onPress={() => router.push(`/prestamos/${prestamo.id}`)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.one }}>
                <ThemedText type="small">
                  S/ {prestamo.capital} · {prestamo.estado}
                </ThemedText>
                <ThemedText type="small" themeColor="primary">
                  Ver →
                </ThemedText>
              </View>
            </Pressable>
          ))}
        </Card>
      )}

      <GenerarAccesoModal
        visible={generarAccesoVisible}
        onCancelar={() => setGenerarAccesoVisible(false)}
        onEnviar={generarAcceso}
      />
    </Screen>
  );
}
