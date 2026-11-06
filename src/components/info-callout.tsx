import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

interface InfoCalloutProps {
  children: string;
}

export function InfoCallout({ children }: InfoCalloutProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}>
      <SymbolView
        name={{ ios: 'info.circle.fill', android: 'info', web: 'info' }}
        size={16}
        tintColor={theme.textSecondary}
      />
      <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
        {children}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  text: {
    flex: 1,
  },
});
