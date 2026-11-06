import { useSyncExternalStore } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import { useAppearanceStore } from '@/stores/appearance-store';

const subscribe = () => () => {};

/**
 * The scheme the app renders in: the user's Appearance choice, else the system's.
 * On web the system value must be re-read on the client, so static rendering stays 'light'.
 */
export function useColorScheme(): 'light' | 'dark' {
  const hasHydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const mode = useAppearanceStore((s) => s.mode);
  const system = useSystemColorScheme();

  if (!hasHydrated) return 'light';
  if (mode !== 'system') return mode;
  return system === 'dark' ? 'dark' : 'light';
}
