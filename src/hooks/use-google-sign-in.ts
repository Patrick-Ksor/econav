import { useSSO } from '@clerk/expo';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleSignIn() {
  // Android's in-app browser is slow to open on first launch unless warmed up ahead
  // of time — no equivalent needed on iOS/web.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  const { startSSOFlow } = useSSO();

  const signInWithGoogle = useCallback(async () => {
    const { createdSessionId, setActive } = await startSSOFlow({
      strategy: 'oauth_google',
      // '/' (not a dedicated '/continue' screen, which this app doesn't have) already
      // redirects based on sign-in state via src/app/index.tsx.
      redirectUrl: AuthSession.makeRedirectUri({ scheme: 'econav', path: '/' }),
    });
    if (createdSessionId && setActive) {
      await setActive({ session: createdSessionId });
    }
  }, [startSSOFlow]);

  return { signInWithGoogle };
}
