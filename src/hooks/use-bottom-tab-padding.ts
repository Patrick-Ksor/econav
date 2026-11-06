import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';

/**
 * Screens use `edges={['top']}` on their SafeAreaView (bottom is intentionally left
 * to the tab bar), but `BottomTabInset` alone is just a guess at the tab bar's own
 * height — it doesn't include the device's home-indicator/gesture-nav safe-area
 * inset. Without adding that in too, content near the bottom of a scroll view can
 * end up rendered under the tab bar and become unreachable/untappable on notched
 * devices. Combine both so bottom clearance is never underestimated.
 */
export function useBottomTabPadding(): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + BottomTabInset;
}
