import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DashedRows, EmptyState } from '@/components/empty-state';
import { FullPageLoader } from '@/components/full-page-loader';
import { StatusBadge, TripStatus } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { InterFont, MaxContentWidth } from '@/constants/theme';
import { useBottomTabPadding } from '@/hooks/use-bottom-tab-padding';
import { useTheme } from '@/hooks/use-theme';
import { formatSignedUsd, formatUsd } from '@/lib/format';
import { formatRelativeTripDate } from '@/lib/relative-date';
import { groupTrips } from '@/lib/trip-groups';
import { useTrips } from '@/services/trips';
import { useVehicleProfile } from '@/services/vehicle-profile';
import { PendingTrip, useTripStore } from '@/stores/trip-store';

type Filter = 'all' | TripStatus;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'pending', label: 'Pending' },
];

export function TripHistoryScreen() {
  const theme = useTheme();
  const bottomPadding = useBottomTabPadding();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));
  const [filter, setFilter] = useState<Filter>('all');
  const { data: trips, isLoading } = useTrips();
  const { data: vehicle } = useVehicleProfile();
  const pending = useTripStore((s) => s.pendingTrip);

  if (isLoading) {
    return <FullPageLoader label="Loading your trips…" />;
  }

  const showPending = !!pending && filter !== 'confirmed';
  const groups = filter === 'pending' ? [] : groupTrips(trips ?? []);
  const isEmpty = !showPending && groups.length === 0;

  if (isEmpty && filter === 'all') {
    return (
      <ThemedView style={styles.flex}>
        <SafeAreaView style={styles.flex} edges={['top']}>
          <View style={[styles.titleRow, styles.emptyHeader]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} style={styles.back}>
              <SymbolView
                name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
                size={22}
                tintColor={theme.text}
              />
            </Pressable>
            <ThemedText style={styles.title}>Trip history</ThemedText>
          </View>
          <EmptyState
            illustration={<DashedRows />}
            title="No trips yet"
            body="Plan a drive, then confirm it when you're back. Your trips and estimated savings will show up here."
            actionLabel="Plan your first trip"
            onAction={() => router.push('/routes')}
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 24 }]}>
          <View style={styles.titleRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} style={styles.back}>
              <SymbolView
                name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
                size={22}
                tintColor={theme.text}
              />
            </Pressable>
            <ThemedText style={styles.title}>Trip history</ThemedText>
          </View>

          <View accessibilityRole="tablist" style={styles.filters}>
            {FILTERS.map((f) => {
              const on = f.id === filter;
              return (
                <Pressable
                  key={f.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  onPress={() => setFilter(f.id)}
                  style={[
                    styles.filter,
                    on
                      ? { backgroundColor: theme.brandFill, borderColor: theme.brandFill }
                      : { backgroundColor: theme.surfaceRaised, borderColor: theme.border },
                  ]}>
                  <ThemedText style={[styles.filterLabel, { color: on ? theme.onBrand : theme.text }]}>
                    {f.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {showPending && pending && (
            <View style={styles.section}>
              <ThemedText type="overline" themeColor="textSecondary" style={styles.sectionTitle}>
                Needs confirming
              </ThemedText>
              <PendingCard trip={pending} vehicleName={vehicle?.makeModel} />
            </View>
          )}

          {groups.map((g) => (
            <View key={g.title} style={styles.section}>
              <ThemedText type="overline" themeColor="textSecondary" style={styles.sectionTitle}>
                {g.title}
              </ThemedText>
              {g.trips.map((t) => (
                <TripCard
                  key={t.id}
                  id={t.id}
                  destination={t.destinationLabel}
                  when={formatRelativeTripDate(t.createdAt)}
                  vehicleName={vehicle?.makeModel}
                  miles={t.distanceMiles}
                  cost={t.estimatedCost}
                  savings={t.savingsDollars ?? null}
                  status="confirmed"
                />
              ))}
            </View>
          ))}

          {isEmpty && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
              {filter === 'pending'
                ? 'No trips waiting to be confirmed.'
                : 'No trips yet — plan a route and confirm it to see it here.'}
            </ThemedText>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function PendingCard({ trip, vehicleName }: { trip: PendingTrip; vehicleName?: string }) {
  return (
    <TripCard
      destination={trip.destinationLabel}
      when={formatRelativeTripDate(trip.startedAt)}
      vehicleName={vehicleName}
      miles={trip.distanceMiles}
      cost={trip.cost}
      savings={trip.savingsDollars}
      status="pending"
    />
  );
}

function TripCard({
  id,
  destination,
  when,
  vehicleName,
  miles,
  cost,
  savings,
  status,
}: {
  id?: string;
  destination: string;
  when: string;
  vehicleName?: string;
  miles: number;
  cost: number;
  savings: number | null;
  status: TripStatus;
}) {
  const theme = useTheme();
  const savingsColor =
    savings == null || status === 'pending' ? theme.textSecondary : savings < 0 ? theme.warnText : theme.success;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => (id ? router.push({ pathname: '/trip-detail', params: { id } }) : router.push('/trip-summary'))}
      style={[styles.card, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
      <View style={styles.cardHead}>
        <ThemedText style={styles.dest} numberOfLines={1}>
          {destination}
        </ThemedText>
        <StatusBadge status={status} />
        <SymbolView
          name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
          size={16}
          tintColor={theme.textTertiary}
        />
      </View>
      <ThemedText style={styles.when} themeColor="textSecondary" numberOfLines={1}>
        {when}
        {vehicleName ? ` · ${vehicleName}` : ''}
      </ThemedText>
      <View style={[styles.stats, { borderTopColor: theme.border }]}>
        <Stat label="Distance" value={`${miles.toFixed(1)} mi`} />
        <Stat label="Est. cost" value={formatUsd(cost)} />
        <Stat
          label="vs. fastest"
          value={savings == null ? '—' : formatSignedUsd(savings)}
          color={savingsColor}
          align="flex-end"
          heavy
        />
      </View>
    </Pressable>
  );
}

function Stat({
  label,
  value,
  color,
  align,
  heavy,
}: {
  label: string;
  value: string;
  color?: string;
  align?: 'flex-end';
  heavy?: boolean;
}) {
  return (
    <View style={[styles.stat, align && { alignItems: align }]}>
      <ThemedText style={styles.statLabel} themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={[styles.statValue, heavy && { fontFamily: InterFont.extrabold }, color ? { color } : null]}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 14, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: InterFont.extrabold, fontSize: 20, lineHeight: 26, letterSpacing: -0.015 * 20 },

  filters: { flexDirection: 'row', gap: 8 },
  filter: { height: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, justifyContent: 'center' },
  filterLabel: { fontFamily: InterFont.bold, fontSize: 13 },

  section: { gap: 10 },
  sectionTitle: { marginTop: 4, paddingHorizontal: 4 },
  empty: { paddingTop: 8 },
  emptyHeader: { paddingHorizontal: 20, paddingTop: 8 },

  card: { gap: 10, padding: 14, borderRadius: 18, borderWidth: 1 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dest: { flex: 1, minWidth: 0, fontFamily: InterFont.bold, fontSize: 16 },
  when: { fontFamily: InterFont.regular, fontSize: 13 },
  stats: { flexDirection: 'row', gap: 8, paddingTop: 10, borderTopWidth: 1 },
  stat: { flex: 1, gap: 1 },
  statLabel: { fontFamily: InterFont.regular, fontSize: 11 },
  statValue: { fontFamily: InterFont.bold, fontSize: 14, fontVariant: ['tabular-nums'] },
});
