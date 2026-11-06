import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';

import { AppHeader } from './app-header';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface FullPageLoaderProps {
  label?: string;
}

/**
 * Shown in place of a whole screen while its essential data (e.g. the vehicle
 * profile a screen can't render meaningfully without) is still loading — not for
 * secondary lists loading in the background alongside content that's already usable.
 */
export function FullPageLoader({ label }: FullPageLoaderProps) {
  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.content}>
          <AppHeader />
          <View style={styles.center}>
            <ActivityIndicator size="large" />
            {label && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
                {label}
              </ThemedText>
            )}
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, padding: Spacing.four },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { marginTop: Spacing.three },
});
