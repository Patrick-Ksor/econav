import { SymbolView } from 'expo-symbols';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

interface AppHeaderProps {
  rightBadge?: ReactNode;
  /** Shows a back button before the brand; used by focused flows that hide the tab bar. */
  onBack?: () => void;
}

/**
 * Shared top bar across the (app) screens, matching the Stitch mockups: logo + brand
 * on the left, an optional badge (e.g. the vehicle's MPG on Routes) on the right.
 * No menu icon — the tab bar already has an explicit Garage tab, so a hamburger
 * here would just be a second, redundant way to reach the same screen.
 */
export function AppHeader({ rightBadge, onBack }: AppHeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <View style={styles.brand}>
        {onBack && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={onBack}
            hitSlop={8}
            style={styles.back}>
            <SymbolView
              name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
              size={20}
              tintColor={theme.text}
            />
          </Pressable>
        )}
        {/* Mockup's TopAppBar renders the "eco" icon and "EcoNav" wordmark in the
            same plain foreground color (text-primary = #ffffff), not a green accent
            — matching that here rather than tinting the icon with the success color. */}
        <SymbolView
          name={{ ios: 'leaf.fill', android: 'eco', web: 'eco' }}
          size={18}
          tintColor={theme.text}
        />
        <ThemedText type="smallBold">EcoNav</ThemedText>
      </View>
      {rightBadge}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  back: {
    width: 44,
    height: 44,
    marginLeft: -12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
