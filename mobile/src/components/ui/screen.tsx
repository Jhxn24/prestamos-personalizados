import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ScreenProps {
  children?: React.ReactNode;
  cargando?: boolean;
  refrescando?: boolean;
  onRefrescar?: () => void;
  vacio?: boolean;
  mensajeVacio?: string;
}

/** Envoltorio común: SafeArea + scroll + pull-to-refresh + estados de carga/vacío. */
export function Screen({
  children,
  cargando,
  refrescando,
  onRefrescar,
  vacio,
  mensajeVacio = 'No hay datos todavía.',
}: ScreenProps) {
  const theme = useTheme();

  if (cargando) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={theme.primary} />
      </ThemedView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          onRefrescar ? (
            <RefreshControl refreshing={!!refrescando} onRefresh={onRefrescar} tintColor={theme.primary} />
          ) : undefined
        }>
        {vacio ? (
          <View style={styles.centeredContent}>
            <ThemedText themeColor="textSecondary">{mensajeVacio}</ThemedText>
          </View>
        ) : (
          children
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  centeredContent: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
});
