import { SymbolView } from 'expo-symbols';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { InterFont } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface SocialAuthButtonsProps {
  onPressGoogle: () => void;
  disabled?: boolean;
}

export function SocialAuthButtons({ onPressGoogle, disabled }: SocialAuthButtonsProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPressGoogle}
        style={[
          styles.googleButton,
          { backgroundColor: theme.brandFill, opacity: disabled ? 0.6 : 1 },
        ]}>
        <ThemedText style={[styles.googleLabel, { color: theme.onBrand }]}>
          {disabled ? 'Signing in…' : 'Continue with Google'}
        </ThemedText>
      </Pressable>

      <View style={[styles.appleButton, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}>
        {/* Real "Sign in with Apple" needs a paid Apple Developer account, which isn't
            set up yet — the button stays visible but inert until that's ready. */}
        {Platform.OS === 'ios' && (
          <SymbolView name="apple.logo" size={16} tintColor={theme.textTertiary} />
        )}
        <ThemedText style={[styles.appleLabel, { color: theme.textTertiary }]}>Apple — coming soon</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  googleButton: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleLabel: { fontFamily: InterFont.bold, fontSize: 17 },
  appleButton: {
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
  },
  appleLabel: { fontFamily: InterFont.semibold, fontSize: 15 },
});
