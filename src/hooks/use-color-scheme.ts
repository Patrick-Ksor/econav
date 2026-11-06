import { useColorScheme as useSystemColorScheme } from 'react-native';

import { useAppearanceStore } from '@/stores/appearance-store';

/** The scheme the app renders in: the user's Appearance choice, else the system's. */
export function useColorScheme(): 'light' | 'dark' {
  const mode = useAppearanceStore((s) => s.mode);
  const system = useSystemColorScheme();
  if (mode !== 'system') return mode;
  return system === 'dark' ? 'dark' : 'light';
}
