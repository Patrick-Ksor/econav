/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// EcoNav design tokens (see econav-handoff/HANDOFF.md). Legacy keys (text … danger) are kept
// so existing screens keep working; `surfaceRaised` is the card color, `tint` is the brand green.
export const Colors = {
  light: {
    text: '#0F172A',
    background: '#F8FAFC',
    backgroundElement: '#F1F5F9',
    backgroundSelected: '#E2E8F0',
    textSecondary: '#64748B',
    textTertiary: '#94A3B8',
    border: '#E2E8F0',
    surfaceRaised: '#FFFFFF',
    tint: '#14532D',
    success: '#15803D',
    danger: '#B91C1C',
    brand: '#14532D',
    brandFill: '#14532D',
    onBrand: '#FFFFFF',
    accent: '#22C55E',
    hero: '#14532D',
    tintBg: '#DCFCE7',
    tabBar: '#FFFFFF',
    warnBg: '#FEF3C7',
    warnText: '#B45309',
    dangerBorder: '#DC2626',
  },
  dark: {
    text: '#F1F5F9',
    background: '#0A110E',
    backgroundElement: '#1A2622',
    backgroundSelected: '#22312B',
    textSecondary: '#94A3B8',
    textTertiary: '#64748B',
    border: '#22312B',
    surfaceRaised: '#121C18',
    tint: '#4ADE80',
    success: '#4ADE80',
    danger: '#F87171',
    brand: '#4ADE80',
    brandFill: '#22C55E',
    onBrand: '#052E16',
    accent: '#22C55E',
    hero: '#123D24',
    tintBg: 'rgba(34,197,94,0.14)',
    tabBar: '#0F1A16',
    warnBg: 'rgba(245,158,11,0.16)',
    warnText: '#FBBF24',
    dangerBorder: '#DC2626',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** Route line colors on the map and in comparison cards. */
export const RouteColors = {
  balanced: '#14532D',
  cheapest: '#2563EB',
  fastest: '#F59E0B',
} as const;

/** Inter weights loaded in the root layout; RN needs one family name per weight. */
export const InterFont = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
/** Map screens (search, compare) are drawn for a phone; on wider windows they stay this wide, centered. */
export const PhoneColumnWidth = 480;
