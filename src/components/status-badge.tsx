import { StyleSheet, View } from 'react-native';

import { InterFont } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

export type TripStatus = 'confirmed' | 'pending';

const LABEL: Record<TripStatus, string> = { confirmed: 'Confirmed', pending: 'Pending' };

/** Small pill showing whether a trip counts toward savings yet. */
export function StatusBadge({ status }: { status: TripStatus }) {
  const theme = useTheme();
  const confirmed = status === 'confirmed';
  return (
    <View style={[styles.badge, { backgroundColor: confirmed ? theme.tintBg : theme.warnBg }]}>
      <ThemedText style={[styles.text, { color: confirmed ? theme.brand : theme.warnText }]}>
        {LABEL[status]}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6 },
  text: { fontFamily: InterFont.bold, fontSize: 11 },
});
