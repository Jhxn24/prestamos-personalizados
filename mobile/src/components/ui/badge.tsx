import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'success' | 'warning';

export function Badge({ label, variant = 'default' }: { label: string; variant?: BadgeVariant }) {
  const theme = useTheme();

  const background =
    variant === 'destructive'
      ? theme.destructive
      : variant === 'success'
        ? theme.success
        : variant === 'warning'
          ? theme.warning
          : variant === 'secondary'
            ? theme.backgroundSelected
            : theme.primary;

  const color =
    variant === 'secondary' ? theme.text : variant === 'destructive' ? theme.destructiveForeground : theme.primaryForeground;

  return (
    <View style={[styles.base, { backgroundColor: background }]}>
      <ThemedText type="small" style={{ color, lineHeight: 16 }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
});
