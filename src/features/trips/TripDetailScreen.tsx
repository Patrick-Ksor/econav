import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { FullPageLoader } from '@/components/full-page-loader';
import { MapIllustration } from '@/components/map-illustration';
import { PrimaryButton } from '@/components/primary-button';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { InterFont, PhoneColumnWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatSignedUsd, formatUsd } from '@/lib/format';
import { useDeleteTrip, useTrips } from '@/services/trips';
import { useVehicleProfile } from '@/services/vehicle-profile';

const MAP_HEIGHT = 230;

const DATE_TIME = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function TripDetailScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const backShadow = useColorScheme() === 'dark' ? '0 4px 14px rgba(0,0,0,0.4)' : '0 4px 14px rgba(15,23,42,0.14)';
  const { id } = useLocalSearchParams<{ id: string }>();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/trip-history'));
  const { data: trips, isLoading } = useTrips();
  const { data: vehicle } = useVehicleProfile();
  const deleteTrip = useDeleteTrip();
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return <FullPageLoader label="Loading trip…" />;
  }

  const trip = trips?.find((t) => t.id === id);
  if (!trip) {
    return (
      <ThemedView style={styles.flex}>
        <SafeAreaView style={[styles.flex, styles.center]}>
          <ThemedText type="heading">Trip not found</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerBody}>
            It may have been removed.
          </ThemedText>
          <PrimaryButton label="Back to trip history" onPress={() => router.replace('/trip-history')} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  const savings = trip.savingsDollars;
  const hasSavings = savings != null;
  const positive = hasSavings && savings >= 0;
  const tone = positive ? theme.success : theme.warnText;
  const rows: [string, string][] = [
    ['Distance', `${trip.distanceMiles.toFixed(1)} mi`],
    ['Fuel avoided', trip.savingsGallons != null ? `${trip.savingsGallons.toFixed(2)} gal` : '—'],
    ['Est. trip cost', formatUsd(trip.estimatedCost)],
  ];

  const onRemove = async () => {
    setError(null);
    try {
      await deleteTrip.mutateAsync(trip.id);
      router.replace('/trip-history');
    } catch {
      setError("Couldn't remove this trip. Try again.");
    }
  };

  return (
    <ThemedView style={styles.flex}>
      <View style={styles.mapWrap}>
        <MapIllustration height={MAP_HEIGHT} accessibilityLabel="Map of the area" />
      </View>
      <ScrollView style={styles.flex} contentContainerStyle={{ paddingTop: MAP_HEIGHT - 24 }}>
        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={styles.heading}>
            <View style={styles.titleRow}>
              <ThemedText style={styles.title}>{trip.destinationLabel}</ThemedText>
              <StatusBadge status="confirmed" />
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.sub}>
              {DATE_TIME.format(new Date(trip.createdAt))}
              {vehicle ? ` · ${vehicle.year} ${vehicle.makeModel}` : ''}
            </ThemedText>
          </View>

          {hasSavings && (
            <View
              style={[
                styles.savings,
                { backgroundColor: positive ? theme.tintBg : theme.warnBg, borderColor: positive ? theme.tintBg : theme.warnBg },
              ]}>
              <View style={styles.savingsText}>
                <ThemedText style={[styles.savingsTitle, { color: positive ? theme.brand : theme.warnText }]}>
                  Estimated savings
                </ThemedText>
                <ThemedText style={styles.savingsNote} themeColor="textSecondary">
                  Compared with the fastest route
                </ThemedText>
              </View>
              <ThemedText style={[styles.savingsValue, { color: tone }]}>{formatSignedUsd(savings)}</ThemedText>
            </View>
          )}

          <View style={[styles.table, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
            {rows.map(([label, value], i) => {
              const last = i === rows.length - 1;
              return (
                <View key={label} style={[styles.tableRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                  <ThemedText style={[styles.tableLabel, last && styles.tableLabelStrong]}>{label}</ThemedText>
                  <ThemedText style={[styles.tableValue, last && styles.tableValueStrong]}>{value}</ThemedText>
                </View>
              );
            })}
          </View>

          <View style={[styles.note, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
            <ThemedText style={styles.noteTitle}>About this estimate</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.noteBody}>
              Calculated from your vehicle&apos;s MPG, fuel price and depreciation setting when you confirmed the trip.
              The fastest route is the baseline for savings.
            </ThemedText>
          </View>

          {error && (
            <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
              {error}
            </ThemedText>
          )}

          {confirmingRemove ? (
            <View style={[styles.confirm, { backgroundColor: theme.surfaceRaised, borderColor: theme.dangerBorder }]}>
              <ThemedText style={styles.confirmTitle}>Remove this trip?</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Its savings will be taken out of your totals. This can&apos;t be undone.
              </ThemedText>
              <View style={styles.confirmActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setConfirmingRemove(false)}
                  style={[styles.actionButton, { borderColor: theme.border, backgroundColor: theme.background }]}>
                  <ThemedText style={styles.actionLabel}>Keep trip</ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={deleteTrip.isPending}
                  onPress={onRemove}
                  style={[styles.actionButton, { borderColor: theme.dangerBorder, backgroundColor: theme.background, opacity: deleteTrip.isPending ? 0.6 : 1 }]}>
                  <ThemedText style={[styles.actionLabel, { color: theme.danger }]}>
                    {deleteTrip.isPending ? 'Removing…' : 'Remove'}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => setConfirmingRemove(true)}
              style={[styles.removeButton, { borderColor: theme.dangerBorder, backgroundColor: theme.surfaceRaised }]}>
              <ThemedText style={[styles.actionLabel, { color: theme.danger }]}>Remove trip</ThemedText>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <View style={[styles.backWrap, { top: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={goBack}
          style={[styles.roundBack, { backgroundColor: theme.surfaceRaised, boxShadow: backShadow }]}>
          <SymbolView
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            size={22}
            tintColor={theme.text}
          />
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { padding: 24, justifyContent: 'center', gap: 8 },
  centerBody: { marginBottom: 16 },
  mapWrap: { position: 'absolute', top: 0, left: 0, right: 0 },
  sheet: {
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 36,
    minHeight: 700,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    maxWidth: PhoneColumnWidth,
    alignSelf: 'center',
  },
  backWrap: { position: 'absolute', left: 16, width: '100%', maxWidth: PhoneColumnWidth, alignSelf: 'center' },
  roundBack: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  heading: { gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontFamily: InterFont.extrabold, fontSize: 24, lineHeight: 30, letterSpacing: -0.02 * 24 },
  sub: { fontSize: 14 },

  savings: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 16, borderRadius: 18, borderWidth: 1 },
  savingsText: { flex: 1, gap: 2 },
  savingsTitle: { fontFamily: InterFont.bold, fontSize: 14 },
  savingsNote: { fontFamily: InterFont.regular, fontSize: 13 },
  savingsValue: { fontFamily: InterFont.extrabold, fontSize: 32, letterSpacing: -0.03 * 32, fontVariant: ['tabular-nums'] },

  table: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 14 },
  tableLabel: { fontFamily: InterFont.medium, fontSize: 14 },
  tableLabelStrong: { fontFamily: InterFont.bold },
  tableValue: { fontFamily: InterFont.semibold, fontSize: 14, fontVariant: ['tabular-nums'] },
  tableValueStrong: { fontFamily: InterFont.extrabold },

  note: { gap: 6, padding: 14, borderRadius: 16, borderWidth: 1 },
  noteTitle: { fontFamily: InterFont.bold, fontSize: 13 },
  noteBody: { lineHeight: 19 },

  removeButton: { height: 52, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontFamily: InterFont.bold, fontSize: 15 },
  confirm: { gap: 8, padding: 14, borderRadius: 16, borderWidth: 1 },
  confirmTitle: { fontFamily: InterFont.bold, fontSize: 15 },
  confirmActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionButton: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
