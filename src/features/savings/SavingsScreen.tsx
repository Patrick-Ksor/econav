import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FullPageLoader } from '@/components/full-page-loader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { InterFont, MaxContentWidth } from '@/constants/theme';
import { useBottomTabPadding } from '@/hooks/use-bottom-tab-padding';
import { useTheme } from '@/hooks/use-theme';
import { formatSignedUsd, formatUsd } from '@/lib/format';
import { formatRelativeTripDate } from '@/lib/relative-date';
import {
  bucketTrips,
  periodRangeLabel,
  previousMonthTotal,
  SavingsPeriod,
  tripsInPeriod,
} from '@/lib/savings-buckets';
import { TripHistoryEntry } from '@/schemas/routing';
import { useTrips, useTripsSummary } from '@/services/trips';

import { SavingsChart } from './SavingsChart';

const PERIODS: { value: SavingsPeriod; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All time' },
];

// The trips endpoint returns at most this many rows, so charts built from it are partial
// for long-time users; totals for "all time" come from the server summary instead.
const TRIP_LIST_CAP = 30;
const ACTIVITY_ROWS = 6;

const MONTH_NAME = new Intl.DateTimeFormat('en-US', { month: 'long' });

export function SavingsScreen() {
  const theme = useTheme();
  const bottomPadding = useBottomTabPadding();
  const [period, setPeriod] = useState<SavingsPeriod>('month');
  const { data: trips, isLoading: isTripsLoading } = useTrips();
  const { data: summary, isLoading: isSummaryLoading } = useTripsSummary();

  if (isTripsLoading || isSummaryLoading) {
    return <FullPageLoader label="Loading your savings…" />;
  }

  const now = new Date();
  const allTrips = trips ?? [];
  const tripCount = summary?.tripCount ?? 0;
  const lifetime = summary?.totalSavingsDollars ?? 0;
  const monthSoFar = summary?.monthSavingsDollars ?? 0;

  const periodTrips = tripsInPeriod(allTrips, period, now);
  const periodTotal =
    period === 'all' ? lifetime : periodTrips.reduce((sum, t) => sum + (t.savingsDollars ?? 0), 0);
  const periodCount = period === 'all' ? tripCount : periodTrips.length;
  const bars = bucketTrips(allTrips, period, now);
  const rangeLabel = periodRangeLabel(period, now);
  const chartIsPartial = (period === 'all' || period === 'year') && allTrips.length >= TRIP_LIST_CAP;

  const prevMonth = previousMonthTotal(allTrips, now);
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const toMatch = prevMonth != null ? prevMonth - monthSoFar : 0;
  const bestTrip = allTrips.reduce((max, t) => Math.max(max, t.savingsDollars ?? 0), 0);
  const card = { backgroundColor: theme.surfaceRaised, borderColor: theme.border };

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 24 }]}>
          <ThemedText type="title">Savings</ThemedText>

          <View style={[styles.hero, { backgroundColor: theme.hero }]}>
            <ThemedText style={styles.heroLabel}>Lifetime estimated savings</ThemedText>
            <ThemedText type="moneyXl" style={styles.heroMoney}>
              {formatUsd(lifetime)}
            </ThemedText>
            <ThemedText style={styles.heroCaption}>
              {tripCount === 0
                ? 'Confirm a trip to start tracking what you save.'
                : `Compared with the fastest route on each of your ${tripCount} confirmed ${tripCount === 1 ? 'trip' : 'trips'}.`}
            </ThemedText>
          </View>

          <View style={[styles.monthCard, card]}>
            <View style={styles.monthLeft}>
              <ThemedText style={styles.monthLabel} themeColor="textSecondary">
                {MONTH_NAME.format(now)} so far
              </ThemedText>
              <ThemedText style={[styles.monthValue, { color: theme.success }]}>{formatUsd(monthSoFar)}</ThemedText>
            </View>
            {prevMonth != null && (
              <View style={styles.monthRight}>
                <ThemedText style={styles.monthLabel} themeColor="textSecondary">
                  {MONTH_NAME.format(new Date(now.getFullYear(), now.getMonth() - 1, 1))}
                </ThemedText>
                <ThemedText style={styles.prevValue}>{formatUsd(prevMonth)}</ThemedText>
                {toMatch > 0 && (
                  <ThemedText style={styles.toMatch} themeColor="textSecondary">
                    {formatUsd(toMatch)} to match, {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
                  </ThemedText>
                )}
              </View>
            )}
          </View>

          <View style={styles.tiles}>
            <StatTile label="Confirmed trips" value={String(tripCount)} />
            <StatTile label="Fuel avoided" value={`${(summary?.totalSavingsGallons ?? 0).toFixed(1)} gal`} />
            <StatTile label="Avg. per trip" value={tripCount > 0 ? formatUsd(lifetime / tripCount) : '—'} />
            <StatTile label="Best trip" value={bestTrip > 0 ? formatUsd(bestTrip) : '—'} />
          </View>

          <View style={[styles.chartCard, card]}>
            <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: theme.backgroundElement }]}>
              {PERIODS.map((p) => {
                const on = p.value === period;
                return (
                  <Pressable
                    key={p.value}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    onPress={() => setPeriod(p.value)}
                    style={[styles.tab, on && { backgroundColor: theme.surfaceRaised, boxShadow: '0 1px 3px rgba(15,23,42,0.12)' }]}>
                    <ThemedText style={[styles.tabLabel, { color: on ? theme.brand : theme.textSecondary }]}>
                      {p.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.chartHead}>
              <View style={styles.chartHeadLeft}>
                <ThemedText style={styles.monthLabel} themeColor="textSecondary">
                  {rangeLabel}
                </ThemedText>
                <ThemedText style={styles.chartTotal}>{formatUsd(periodTotal)}</ThemedText>
              </View>
              <ThemedText style={styles.chartTrips} themeColor="textSecondary">
                {periodCount} {periodCount === 1 ? 'trip' : 'trips'}
              </ThemedText>
            </View>

            {bars.every((b) => b.value === 0) ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyChart}>
                Nothing saved in this period yet. Confirm a trip to see it here.
              </ThemedText>
            ) : (
              <>
                <SavingsChart
                  bars={bars}
                  accessibilityLabel={`Estimated savings by period, ${rangeLabel}, total ${formatUsd(periodTotal)}`}
                />
                <View style={styles.legend}>
                  <LegendDot color={theme.success} label="Saved vs. fastest" />
                  <LegendDot color={theme.warnText} label="Cost more (below line)" />
                </View>
              </>
            )}
            {chartIsPartial && (
              <ThemedText type="small" themeColor="textSecondary">
                Based on your {TRIP_LIST_CAP} most recent trips{period === 'all' ? '; the total covers all of them' : ''}.
              </ThemedText>
            )}
          </View>

          <View style={styles.activity}>
            <View style={styles.activityHeader}>
              <ThemedText type="heading">Recent activity</ThemedText>
              <Pressable accessibilityRole="button" onPress={() => router.push('/trip-history')} style={styles.allTrips}>
                <ThemedText style={[styles.allTripsText, { color: theme.brand }]}>All trips</ThemedText>
              </Pressable>
            </View>
            {periodTrips.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                No confirmed trips in this period yet.
              </ThemedText>
            ) : (
              <View style={[styles.activityList, card]}>
                {periodTrips.slice(0, ACTIVITY_ROWS).map((trip, i) => (
                  <ActivityRow key={trip.id} trip={trip} divider={i > 0} />
                ))}
              </View>
            )}
          </View>

          <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>
            Savings are estimates based on your vehicle settings and fuel prices at the time of each trip. They
            aren&apos;t guaranteed and won&apos;t match your bank statement exactly.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
      <ThemedText style={styles.monthLabel} themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.tileValue}>{value}</ThemedText>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <ThemedText style={styles.legendText} themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

function ActivityRow({ trip, divider }: { trip: TripHistoryEntry; divider: boolean }) {
  const theme = useTheme();
  const delta = trip.savingsDollars;
  const hasDelta = delta != null;
  const positive = hasDelta && delta >= 0;
  const tone = !hasDelta ? theme.textSecondary : positive ? theme.success : theme.warnText;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/trip-detail', params: { id: trip.id } })}
      style={[styles.row, divider && { borderTopWidth: 1, borderTopColor: theme.border }]}>
      <View
        style={[
          styles.rowIcon,
          { backgroundColor: !hasDelta ? theme.backgroundElement : positive ? theme.tintBg : theme.warnBg },
        ]}>
        <SymbolView
          name={
            positive || !hasDelta
              ? { ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }
              : { ios: 'arrow.down', android: 'arrow_downward', web: 'arrow_downward' }
          }
          size={16}
          tintColor={tone}
        />
      </View>
      <View style={styles.rowText}>
        <ThemedText style={styles.rowDest} numberOfLines={1}>
          {trip.destinationLabel}
        </ThemedText>
        <ThemedText style={styles.rowMeta} themeColor="textSecondary">
          {formatRelativeTripDate(trip.createdAt)} · {trip.distanceMiles.toFixed(1)} mi
        </ThemedText>
      </View>
      <ThemedText style={[styles.rowAmount, { color: tone }]}>
        {hasDelta ? formatSignedUsd(delta) : '—'}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, gap: 14, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },

  hero: { gap: 6, padding: 20, borderRadius: 22 },
  heroLabel: { fontFamily: InterFont.semibold, fontSize: 14, color: '#BBF7D0' },
  heroMoney: { color: '#FFFFFF' },
  heroCaption: { fontFamily: InterFont.regular, fontSize: 13, lineHeight: 19, color: '#BBF7D0' },

  monthCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 16, borderRadius: 18, borderWidth: 1 },
  monthLeft: { gap: 2 },
  monthRight: { alignItems: 'flex-end', gap: 2, flexShrink: 1 },
  monthLabel: { fontFamily: InterFont.medium, fontSize: 12 },
  monthValue: { fontFamily: InterFont.extrabold, fontSize: 24, letterSpacing: -0.02 * 24, fontVariant: ['tabular-nums'] },
  prevValue: { fontFamily: InterFont.bold, fontSize: 18, fontVariant: ['tabular-nums'] },
  toMatch: { fontFamily: InterFont.semibold, fontSize: 12, textAlign: 'right' },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexGrow: 1, flexBasis: '45%', gap: 4, padding: 14, borderRadius: 16, borderWidth: 1 },
  tileValue: { fontFamily: InterFont.extrabold, fontSize: 20, fontVariant: ['tabular-nums'] },

  chartCard: { gap: 14, padding: 16, borderRadius: 20, borderWidth: 1 },
  tabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 12 },
  tab: { flex: 1, height: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontFamily: InterFont.bold, fontSize: 13 },
  chartHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  chartHeadLeft: { gap: 2 },
  chartTotal: { fontFamily: InterFont.extrabold, fontSize: 26, letterSpacing: -0.02 * 26, fontVariant: ['tabular-nums'] },
  chartTrips: { fontFamily: InterFont.semibold, fontSize: 13 },
  emptyChart: { paddingVertical: 24, textAlign: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontFamily: InterFont.regular, fontSize: 12 },

  activity: { gap: 10, paddingTop: 6 },
  activityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  allTrips: { minHeight: 36, justifyContent: 'center' },
  allTripsText: { fontFamily: InterFont.semibold, fontSize: 14 },
  activityList: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62, paddingVertical: 10, paddingHorizontal: 14 },
  rowIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowDest: { fontFamily: InterFont.semibold, fontSize: 15 },
  rowMeta: { fontFamily: InterFont.regular, fontSize: 12 },
  rowAmount: { fontFamily: InterFont.bold, fontSize: 15, fontVariant: ['tabular-nums'] },

  disclaimer: { lineHeight: 18 },
});
