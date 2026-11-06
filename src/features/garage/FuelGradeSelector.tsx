import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { FuelGrade } from '@/schemas/vehicle';
import { useTheme } from '@/hooks/use-theme';

const OPTIONS: { value: FuelGrade; label: string }[] = [
  { value: 'regular', label: 'Regular' },
  { value: 'premium', label: 'Premium' },
  { value: 'diesel', label: 'Diesel' },
];

interface FuelGradeSelectorProps {
  value: FuelGrade;
  onChange: (value: FuelGrade) => void;
}

export function FuelGradeSelector({ value, onChange }: FuelGradeSelectorProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.option,
              { borderColor: theme.border },
              selected && { backgroundColor: theme.brandFill, borderColor: theme.brandFill },
            ]}>
            <ThemedText type="smallBold" style={{ color: selected ? theme.onBrand : theme.text }}>
              {option.label}
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
    gap: Spacing.two,
  },
  option: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
});
