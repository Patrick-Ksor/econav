import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { InterFont, MaxContentWidth, RouteColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration } from '@/lib/duration';
import { formatSignedUsd, formatUsd } from '@/lib/format';
import { generateId } from '@/lib/id';
import { formatRelativeTripDate } from '@/lib/relative-date';
import { useAddTrip, useTripsSummary } from '@/services/trips';
import { useTripStore } from '@/stores/trip-store';

/**
 * Step 3 of the trip flow. Savings only count once the trip is confirmed here — merely
 * calculating or launching a route records nothing.
 */
export function TripSummaryScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pending = useTripStore((s) => s.pendingTrip);
  const clearPendingTrip = useTripStore((s) => s.clearPendingTrip);
  const addTrip = useAddTrip();
  const { data: summary } = useTripsSummary();
  // Set once the trip is saved, to show the success screen.
  const [confirmed, setConfirmed] = useState<{ delta: number; lifetime: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (confirmed) {
    return (
      <View style={[styles.success, { backgroundColor: theme.hero }]}>
        <SafeAreaView style={styles.successInner}>
          <View style={styles.successCenter}>
            <View style={styles.successCheck}>
              <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={48} tintColor="#052E16" />
            </View>
            <ThemedText style={styles.successTitle}>Trip confirmed</ThemedText>
            <ThemedText type="moneyXl" style={styles.successMoney}>
              {formatSignedUsd(confirmed.delta)}
            </ThemedText>
            <ThemedText style={styles.successNote}>added to your estimated savings</ThemedText>
            <View style={styles.lifetime}>
              <ThemedText style={styles.lifetimeLabel}>Lifetime estimated savings</ThemedText>
              <ThemedText style={styles.lifetimeValue}>{formatUsd(confirmed.lifetime)}</ThemedText>
            </View>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/savings')} style={styles.doneButton}>
            <ThemedText style={styles.doneLabel}>Done</ThemedText>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  if (!pending) {
    return (
      <ThemedView style={styles.flex}>
        <SafeAreaView style={[styles.flex, styles.center]}>
          <ThemedText type="heading">Nothing to confirm</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerBody}>
            Trips you start from a route comparison show up here.
          </ThemedText>
          <PrimaryButton label="Back to Home" onPress={() => router.replace('/home')} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  const minutesVsFastest = Math.round(pending.durationMinutes - pending.baselineMinutes);
  const timeNote =
    minutesVsFastest > 0
      ? `${minutesVsFastest} min longer than fastest`
      : minutesVsFastest < 0
        ? `${Math.abs(minutesVsFastest)} min faster than fastest`
        : 'Same time as fastest';
  const positive = pending.savingsDollars >= 0;

  const onConfirm = async () => {
    setError(null);
    try {
      await addTrip.mutateAsync({
        id: generateId(),
        destinationLabel: pending.destinationLabel,
        distanceMiles: pending.distanceMiles,
        estimatedCost: pending.cost,
        createdAt: pending.startedAt,
        savingsDollars: pending.savingsDollars,
        savingsGallons: pending.savingsGallons,
      });
      clearPendingTrip();
      setConfirmed({
        delta: pending.savingsDollars,
        lifetime: (summary?.totalSavingsDollars ?? 0) + pending.savingsDollars,
      });
    } catch {
      setError("Couldn't save this trip. Check your connection and try again.");
    }
  };

  const onDiscard = () => {
    clearPendingTrip();
    router.replace('/home');
  };

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.topRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={() => router.replace('/home')}
              style={styles.close}>
              <SymbolView
                name={{ ios: 'xmark', android: 'close', web: 'close' }}
                size={20}
                tintColor={theme.text}
              />
            </Pressable>
            <ThemedText type="small" themeColor="textSecondary" style={styles.when}>
              {formatRelativeTripDate(pending.startedAt)}
            </ThemedText>
          </View>

          <View style={styles.heading}>
            <ThemedText style={styles.title}>Welcome back. How did it go?</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.lede}>
              Confirm this trip to add it to your savings.
            </ThemedText>
          </View>

          <View style={[styles.card, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
            <View style={styles.fromTo}>
              <View style={styles.rail}>
                <View style={[styles.railDot, { backgroundColor: RouteColors.cheapest }]} />
                <View style={[styles.railLine, { backgroundColor: theme.border }]} />
                <View style={[styles.railDot, { backgroundColor: theme.brand }]} />
              </View>
              <View style={styles.fromToText}>
                <View>
                  <ThemedText style={styles.fieldLabel} themeColor="textSecondary">
                    From
                  </ThemedText>
                  <ThemedText style={styles.fieldValue} numberOfLines={1}>
                    {pending.originLabel}
                  </ThemedText>
                </View>
                <View>
                  <ThemedText style={styles.fieldLabel} themeColor="textSecondary">
                    To
                  </ThemedText>
                  <ThemedText style={styles.fieldValue} numberOfLines={2}>
                    {pending.destinationLabel}
                  </ThemedText>
                </View>
              </View>
            </View>

            <View style={styles.tiles}>
              <View style={[styles.tile, { backgroundColor: theme.background }]}>
                <ThemedText style={styles.fieldLabel} themeColor="textSecondary">
                  Route
                </ThemedText>
                <View style={styles.routeValue}>
                  <View style={[styles.routeSwatch, { backgroundColor: pending.routeColor }]} />
                  <ThemedText style={styles.tileValue} numberOfLines={1}>
                    {pending.routeLabel}
                  </ThemedText>
                </View>
              </View>
              <Tile label="Distance" value={`${pending.distanceMiles.toFixed(1)} mi`} />
              <Tile label="Duration" value={formatDuration(pending.durationMinutes)} />
            </View>

            <View style={styles.costs}>
              <View style={styles.costRow}>
                <ThemedText style={styles.costLabel}>Your route · est. cost</ThemedText>
                <ThemedText style={styles.costValue}>{formatUsd(pending.cost)}</ThemedText>
              </View>
              <View style={styles.costRow}>
                <ThemedText style={styles.costLabel}>Baseline · fastest route</ThemedText>
                <ThemedText style={styles.costValue}>{formatUsd(pending.baselineCost)}</ThemedText>
              </View>
              <View style={[styles.savings, { backgroundColor: positive ? theme.tintBg : theme.warnBg }]}>
                <View style={styles.savingsText}>
                  <ThemedText style={[styles.savingsTitle, { color: positive ? theme.brand : theme.warnText }]}>
                    Estimated savings
                  </ThemedText>
                  <ThemedText style={[styles.savingsNote, { color: theme.textSecondary }]}>{timeNote}</ThemedText>
                </View>
                <ThemedText style={[styles.savingsValue, { color: positive ? theme.success : theme.warnText }]}>
                  {formatSignedUsd(pending.savingsDollars)}
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={[styles.disclaimer, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
            <SymbolView
              name={{ ios: 'info.circle', android: 'info', web: 'info' }}
              size={18}
              tintColor={theme.textSecondary}
            />
            <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimerText}>
              This is an estimate compared with the fastest route available when you left, not a verified saving in
              your bank account. Only confirmed trips count toward your lifetime savings.
            </ThemedText>
          </View>

          {error && (
            <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
              {error}
            </ThemedText>
          )}
        </ScrollView>

        <View style={[styles.actions, { paddingBottom: 12 + insets.bottom }]}>
          <PrimaryButton
            label={addTrip.isPending ? 'Saving…' : 'Confirm trip'}
            leadingIcon={{ ios: 'checkmark', android: 'check', web: 'check' }}
            onPress={onConfirm}
            disabled={addTrip.isPending}
          />
          <Pressable accessibilityRole="button" onPress={onDiscard} style={styles.discard}>
            <ThemedText style={{ color: theme.danger, fontFamily: InterFont.semibold, fontSize: 15 }}>
              Discard trip
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: theme.background }]}>
      <ThemedText style={styles.fieldLabel} themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.tileValue}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { padding: 24, justifyContent: 'center', gap: 8 },
  success: { flex: 1, alignItems: 'center' },
  successInner: { flex: 1, width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: 20, paddingBottom: 20 },
  successCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  successCheck: { width: 112, height: 112, borderRadius: 56, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  successTitle: { fontFamily: InterFont.bold, fontSize: 26, color: '#FFFFFF' },
  successMoney: { color: '#FFFFFF', fontSize: 56, lineHeight: 60 },
  successNote: { fontFamily: InterFont.medium, fontSize: 16, color: '#BBF7D0' },
  lifetime: { alignItems: 'center', gap: 2, marginTop: 18, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)' },
  lifetimeLabel: { fontFamily: InterFont.medium, fontSize: 14, color: '#BBF7D0' },
  lifetimeValue: { fontFamily: InterFont.extrabold, fontSize: 30, color: '#FFFFFF', letterSpacing: -0.02 * 30, fontVariant: ['tabular-nums'] },
  doneButton: { height: 56, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  doneLabel: { fontFamily: InterFont.bold, fontSize: 17, color: '#14532D' },
  centerBody: { marginBottom: 16 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 18, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  when: { fontFamily: InterFont.semibold },
  heading: { gap: 6 },
  title: { fontFamily: InterFont.extrabold, fontSize: 28, lineHeight: 32, letterSpacing: -0.025 * 28 },
  lede: { fontFamily: InterFont.regular, fontSize: 15, lineHeight: 22 },

  card: { gap: 16, padding: 18, borderRadius: 20, borderWidth: 1 },
  fromTo: { flexDirection: 'row', gap: 14 },
  rail: { alignItems: 'center', paddingTop: 5 },
  railDot: { width: 10, height: 10, borderRadius: 5 },
  railLine: { width: 2, height: 46 },
  fromToText: { flex: 1, minWidth: 0, gap: 18 },
  fieldLabel: { fontFamily: InterFont.regular, fontSize: 12 },
  fieldValue: { fontFamily: InterFont.semibold, fontSize: 15 },

  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, minWidth: 0, gap: 2, padding: 10, borderRadius: 12 },
  tileValue: { fontFamily: InterFont.bold, fontSize: 15 },
  routeValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeSwatch: { width: 8, height: 8, borderRadius: 4 },

  costs: { gap: 10 },
  costRow: { flexDirection: 'row', justifyContent: 'space-between' },
  costLabel: { fontFamily: InterFont.regular, fontSize: 15 },
  costValue: { fontFamily: InterFont.bold, fontSize: 15, fontVariant: ['tabular-nums'] },
  savings: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, marginTop: 4, borderRadius: 14 },
  savingsText: { flex: 1, gap: 2 },
  savingsTitle: { fontFamily: InterFont.bold, fontSize: 14 },
  savingsNote: { fontFamily: InterFont.regular, fontSize: 12 },
  savingsValue: { fontFamily: InterFont.extrabold, fontSize: 30, letterSpacing: -0.03 * 30, fontVariant: ['tabular-nums'] },

  disclaimer: { flexDirection: 'row', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1 },
  disclaimerText: { flex: 1, lineHeight: 19 },

  actions: { gap: 8, paddingHorizontal: 20, paddingTop: 8, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  discard: { height: 48, alignItems: 'center', justifyContent: 'center' },
});
