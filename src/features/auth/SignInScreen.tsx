import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GridBackdrop } from '@/components/grid-backdrop';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { InterFont, MaxContentWidth } from '@/constants/theme';
import { useGoogleSignIn } from '@/hooks/use-google-sign-in';
import { useTheme } from '@/hooks/use-theme';

import { SocialAuthButtons } from './SocialAuthButtons';

export function SignInScreen() {
  const theme = useTheme();
  const { signInWithGoogle } = useGoogleSignIn();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <ThemedView style={styles.flex}>
      <GridBackdrop />
      <SafeAreaView style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.logoBadge, { backgroundColor: theme.tintBg }]}>
            <SymbolView
              name={{ ios: 'leaf.fill', android: 'eco', web: 'eco' }}
              size={26}
              tintColor={theme.brand}
            />
          </View>

          <View style={styles.heading}>
            <ThemedText style={styles.title}>Welcome to EcoNav</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Drive smarter. Save on every mile.
            </ThemedText>
          </View>

          {error && (
            <View
              accessibilityRole="alert"
              style={[styles.errorBanner, { backgroundColor: theme.warnBg, borderColor: theme.dangerBorder }]}>
              <SymbolView
                name={{ ios: 'exclamationmark.circle', android: 'error', web: 'error' }}
                size={18}
                tintColor={theme.danger}
              />
              <ThemedText style={[styles.errorText, { color: theme.danger }]}>{error}</ThemedText>
            </View>
          )}

          <View style={styles.authSection}>
            <SocialAuthButtons onPressGoogle={handleGoogleSignIn} disabled={isSigningIn} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 36,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: 22,
  },
  logoBadge: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  heading: { gap: 6 },
  title: { fontFamily: InterFont.extrabold, fontSize: 28, lineHeight: 32, letterSpacing: -0.025 * 28 },
  subtitle: { fontFamily: InterFont.regular, fontSize: 15, lineHeight: 22 },
  errorBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  errorText: { flex: 1, fontFamily: InterFont.regular, fontSize: 14, lineHeight: 20 },
  authSection: { marginTop: 8 },
});
