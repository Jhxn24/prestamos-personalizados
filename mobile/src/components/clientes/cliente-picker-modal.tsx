import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Cliente } from '@/lib/types';

interface ClientePickerModalProps {
  visible: boolean;
  clientes: Cliente[];
  onSeleccionar: (cliente: Cliente) => void;
  onClose: () => void;
}

/** Modal de búsqueda para elegir un cliente activo — usado al registrar un préstamo nuevo. */
export function ClientePickerModal({ visible, clientes, onSeleccionar, onClose }: ClientePickerModalProps) {
  const theme = useTheme();
  const [busqueda, setBusqueda] = useState('');

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return clientes;
    return clientes.filter((cliente) =>
      `${cliente.nombre} ${cliente.apellido} ${cliente.documento}`.toLowerCase().includes(termino)
    );
  }, [clientes, busqueda]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ThemedView style={{ flex: 1 }}>
        <View style={[styles.header, { borderColor: theme.border }]}>
          <ThemedText type="smallBold">Elegir cliente</ThemedText>
          <Button title="Cerrar" variant="secondary" onPress={onClose} />
        </View>
        <View style={{ padding: Spacing.three }}>
          <TextField label="Buscar" value={busqueda} onChangeText={setBusqueda} placeholder="Nombre o documento" />
        </View>
        <Screen vacio={filtrados.length === 0} mensajeVacio="Sin resultados.">
          {filtrados.map((cliente) => (
            <Pressable
              key={cliente.id}
              onPress={() => onSeleccionar(cliente)}
              style={[styles.item, { borderColor: theme.border }]}>
              <ThemedText type="smallBold">
                {cliente.nombre} {cliente.apellido}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {cliente.documento}
              </ThemedText>
            </Pressable>
          ))}
        </Screen>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.six,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  item: {
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
