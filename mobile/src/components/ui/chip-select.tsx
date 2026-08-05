import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface ChipSelectProps<T extends string> {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Fila de chips seleccionables — reemplazo simple de un <select> para enums cortos. */
export function ChipSelect<T extends string>({ options, value, onChange }: ChipSelectProps<T>) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {options.map((opcion) => {
        const seleccionado = opcion.value === value;
        return (
          <Pressable
            key={opcion.value}
            onPress={() => onChange(opcion.value)}
            style={[
              styles.chip,
              {
                backgroundColor: seleccionado ? theme.primary : theme.backgroundElement,
                borderColor: theme.border,
              },
            ]}>
            <ThemedText type="small" style={{ color: seleccionado ? theme.primaryForeground : theme.text }}>
              {opcion.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
