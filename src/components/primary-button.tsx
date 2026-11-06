import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { InterFont } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Optional icon after the label, e.g. an arrow. Receives the label color. */
  trailingIcon?: SymbolViewProps['name'];
  /** Optional icon before the label, e.g. a check. */
  leadingIcon?: SymbolViewProps['name'];
}

/** Design-system primary button: 56px tall, radius 16, brand fill. */
export function PrimaryButton({ label, onPress, disabled, trailingIcon, leadingIcon }: PrimaryButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.brandFill },
        (pressed || disabled) && styles.dimmed,
      ]}>
      {leadingIcon && <SymbolView name={leadingIcon} size={20} tintColor={theme.onBrand} />}
      <ThemedText style={[styles.label, { color: theme.onBrand }]}>{label}</ThemedText>
      {trailingIcon && <SymbolView name={trailingIcon} size={20} tintColor={theme.onBrand} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  dimmed: { opacity: 0.6 },
  label: { fontFamily: InterFont.bold, fontSize: 16, lineHeight: 22 },
});

/** Outlined companion to PrimaryButton for lower-emphasis actions. */
export function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        secondaryStyles.button,
        { backgroundColor: theme.surfaceRaised, borderColor: theme.border },
        pressed && { opacity: 0.7 },
      ]}>
      <ThemedText style={[secondaryStyles.label, { color: theme.text }]}>{label}</ThemedText>
    </Pressable>
  );
}

const secondaryStyles = StyleSheet.create({
  button: { height: 52, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  label: { fontFamily: InterFont.semibold, fontSize: 15 },
});
