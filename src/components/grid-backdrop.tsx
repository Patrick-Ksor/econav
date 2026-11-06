import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

const CELL_SIZE = 24;

/**
 * The "telemetry grid" texture behind the Stitch sign-in mockup: a faint 24px
 * grid of 1px lines at ~3% opacity. Built from plain Views (not a CSS
 * background-image, which only React Native Web understands) so it renders the
 * same on every platform.
 */
export function GridBackdrop() {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const verticalCount = Math.ceil(width / CELL_SIZE);
  const horizontalCount = Math.ceil(height / CELL_SIZE);

  return (
    <View style={[StyleSheet.absoluteFill, styles.grid]} pointerEvents="none">
      {Array.from({ length: verticalCount }, (_, i) => (
        <View
          key={`v-${i}`}
          style={[styles.verticalLine, { left: i * CELL_SIZE, backgroundColor: theme.text }]}
        />
      ))}
      {Array.from({ length: horizontalCount }, (_, i) => (
        <View
          key={`h-${i}`}
          style={[styles.horizontalLine, { top: i * CELL_SIZE, backgroundColor: theme.text }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { opacity: 0.03 },
  verticalLine: { position: 'absolute', top: 0, bottom: 0, width: 1 },
  horizontalLine: { position: 'absolute', left: 0, right: 0, height: 1 },
});
