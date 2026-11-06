import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { InterFont } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatUsd } from '@/lib/format';
import { SavingsBar } from '@/lib/savings-buckets';

const PLOT_HEIGHT = 136;
const LABEL_ROOM = 18; // headroom above the tallest positive bar for its value label

/**
 * Bars above the zero line are savings, bars below it are trips that cost more than the
 * fastest route — same encoding as the design's savings chart. Heights scale to the
 * larger of the biggest gain and biggest loss so both fit.
 */
export function SavingsChart({ bars, accessibilityLabel }: { bars: SavingsBar[]; accessibilityLabel: string }) {
  const theme = useTheme();
  const posMax = Math.max(0, ...bars.map((b) => b.value));
  const negMax = Math.max(0, ...bars.map((b) => -b.value));
  const span = posMax + negMax || 1;
  const scale = PLOT_HEIGHT / span;
  const zero = LABEL_ROOM + posMax * scale;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <View style={[styles.plot, { height: LABEL_ROOM + PLOT_HEIGHT + LABEL_ROOM }]}>
        <View style={[styles.zeroLine, { top: zero, backgroundColor: theme.border }]} />
        {bars.map((bar, i) => {
          const neg = bar.value < 0;
          const h = Math.max(bar.value === 0 ? 2 : 3, Math.abs(bar.value) * scale);
          const top = neg ? zero : zero - h;
          const color = bar.value === 0 ? theme.border : neg ? theme.warnText : theme.success;
          return (
            <View key={`${bar.label}-${i}`} style={styles.column}>
              {bar.value !== 0 && (
                <ThemedText
                  style={[
                    styles.valueLabel,
                    { top: neg ? zero + h + 3 : top - 15, color: neg ? theme.warnText : theme.textSecondary },
                  ]}>
                  {formatUsd(bar.value)}
                </ThemedText>
              )}
              <View
                style={[
                  styles.bar,
                  {
                    top,
                    height: h,
                    backgroundColor: color,
                    borderTopLeftRadius: neg ? 0 : 5,
                    borderTopRightRadius: neg ? 0 : 5,
                    borderBottomLeftRadius: neg ? 5 : 0,
                    borderBottomRightRadius: neg ? 5 : 0,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.axis}>
        {bars.map((bar, i) => (
          <ThemedText key={`${bar.label}-${i}`} style={styles.axisLabel} themeColor="textSecondary" numberOfLines={1}>
            {bar.label}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: 'row', gap: 6 },
  zeroLine: { position: 'absolute', left: 0, right: 0, height: 1 },
  column: { flex: 1, alignItems: 'center' },
  bar: { position: 'absolute', left: '18%', right: '18%' },
  valueLabel: {
    position: 'absolute',
    fontFamily: InterFont.bold,
    fontSize: 10,
    lineHeight: 12,
    textAlign: 'center',
    minWidth: 40,
  },
  axis: { flexDirection: 'row', gap: 6, marginTop: 2 },
  axisLabel: { flex: 1, textAlign: 'center', fontFamily: InterFont.medium, fontSize: 11 },
});
