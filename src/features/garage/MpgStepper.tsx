import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const PRESETS = [24, 33, 43, 52];
const STEP = 0.5;
const L_PER_100KM_FACTOR = 235.214; // US gallons/mile -> liters/100km

interface MpgStepperProps {
  value: number;
  onChange: (value: number) => void;
}

export function MpgStepper({ value, onChange }: MpgStepperProps) {
  const theme = useTheme();
  const litersPer100km = L_PER_100KM_FACTOR / value;

  return (
    <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}>
      <View style={styles.header}>
        <ThemedText type="small" themeColor="textSecondary">
          Average MPG Rating
        </ThemedText>
        <View style={[styles.badge, { borderColor: theme.border }]}>
          <ThemedText type="small" themeColor="textSecondary">
            COMBINED
          </ThemedText>
        </View>
      </View>

      <View style={styles.valueRow}>
        <View>
          <View style={styles.valueLine}>
            <ThemedText type="title">{value}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              MPG
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textTertiary">
            {litersPer100km.toFixed(1)} L/100km equiv.
          </ThemedText>
        </View>
        <View style={[styles.stepper, { borderColor: theme.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decrease MPG"
            onPress={() => onChange(Math.max(1, value - STEP))}
            style={styles.stepButton}>
            <ThemedText type="subtitle">−</ThemedText>
          </Pressable>
          <View style={[styles.stepDivider, { backgroundColor: theme.border }]} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Increase MPG"
            onPress={() => onChange(value + STEP)}
            style={styles.stepButton}>
            <ThemedText type="subtitle">+</ThemedText>
          </Pressable>
        </View>
      </View>

      <View style={styles.presetRow}>
        <ThemedText type="small" themeColor="textTertiary">
          PRESETS:
        </ThemedText>
        {PRESETS.map((preset) => (
          <Pressable
            key={preset}
            accessibilityRole="button"
            onPress={() => onChange(preset)}
            style={[
              styles.presetChip,
              { borderColor: theme.border },
              preset === value && { backgroundColor: theme.tintBg, borderColor: theme.brand },
            ]}>
            <ThemedText type="small">{preset}</ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.five,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  valueLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
  },
  stepButton: {
    width: 44,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  presetChip: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
});
