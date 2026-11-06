import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type AppearanceMode = 'system' | 'light' | 'dark';

interface AppearanceStore {
  mode: AppearanceMode;
  setMode: (mode: AppearanceMode) => void;
}

export const useAppearanceStore = create<AppearanceStore>()(
  persist(
    (set) => ({
      mode: 'system',
      setMode: (mode) => set({ mode }),
    }),
    { name: 'econav.appearance.v1', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
