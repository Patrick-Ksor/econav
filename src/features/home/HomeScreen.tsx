import { useUser } from '@clerk/expo';
import { router } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { EmptyState, IconTile } from '@/components/empty-state';
import { FullPageLoader } from '@/components/full-page-loader';
import { MapIllustration } from '@/components/map-illustration';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { InterFont, MaxContentWidth } from '@/constants/theme';
import { useBottomTabPadding } from '@/hooks/use-bottom-tab-padding';
import { useTheme } from '@/hooks/use-theme';
import { formatSignedUsd, formatUsd } from '@/lib/format';
import { formatRelativeTripDate, getTimeOfDayGreeting } from '@/lib/relative-date';
import { TripHistoryEntry } from '@/schemas/routing';
import { useRoutePreferences } from '@/services/route-preferences';
import { useTrips, useTripsSummary } from '@/services/trips';
import { useVehicleProfile } from '@/services/vehicle-profile';
import { useTripStore } from '@/stores/trip-store';

const PRIORITY_LABEL = { cost: 'Lowest cost', balance: 'Balanced', fast: 'Fastest' } as const;

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
});

// The hero card is a brand-colored surface in both themes, so its inner text colors are fixed.
const HERO_LABEL = '#BBF7D0';
const HERO_TAG_TEXT = '#DCFCE7';
const HERO_TILE = 'rgba(255,255,255,0.08)';

export function HomeScreen() {
  const theme = useTheme();
  const isDark = useColorScheme() === 'dark';
  const bottomPadding = useBottomTabPadding();
  const { user } = useUser();
  const { data: vehicleProfile, isLoading: isProfileLoading } = useVehicleProfile();
  const { data: trips = [] } = useTrips();
  const { data: summary } = useTripsSummary();
  const pendingTrip = useTripStore((s) => s.pendingTrip);
  const { data: prefs } = useRoutePreferences();

  if (isProfileLoading) {
    return <FullPageLoader label="Loading your dashboard…" />;
  }

  if (!vehicleProfile) {
    return (
      <ThemedView style={styles.flex}>
        <SafeAreaView style={styles.flex}>
          <EmptyState
            illustration={<IconTile icon={{ ios: 'car.fill', android: 'directions_car', web: 'directions_car' }} />}
            title="Add a vehicle to see real costs"
            body="Without one, EcoNav can only compare travel time. It takes about a minute."
            actionLabel="Add Vehicle"
            onAction={() => router.push('/add-vehicle')}
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  const initials =
    [user?.firstName, user?.lastName]
      .filter(Boolean)
      .map((n) => n![0])
      .join('')
      .toUpperCase() || 'EN';
  const recentTrips = trips.slice(0, 3);
  const totalSavings = summary?.totalSavingsDollars ?? 0;
  const tripCount = summary?.tripCount ?? 0;
  const shadow = isDark ? '0 8px 24px rgba(0,0,0,0.35)' : '0 8px 24px rgba(15,23,42,0.07)';

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 24 }]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.dateLabel}>
                {DATE_FORMAT.format(new Date())}
              </ThemedText>
              <ThemedText style={styles.greeting} numberOfLines={1}>
                {getTimeOfDayGreeting()}
                {user?.firstName ? `, ${user.firstName}` : ''}
              </ThemedText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Profile"
              onPress={() => router.push('/profile')}
              style={[styles.avatar, { backgroundColor: theme.tintBg }]}>
              <ThemedText style={[styles.avatarText, { color: theme.brand }]}>{initials}</ThemedText>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Plan a route"
            onPress={() => router.push('/routes')}
            style={[
              styles.searchCard,
              { backgroundColor: theme.surfaceRaised, borderColor: theme.border, boxShadow: shadow },
            ]}>
            <SymbolView
              name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
              size={22}
              tintColor={theme.brand}
            />
            <ThemedText style={styles.searchPlaceholder} themeColor="textSecondary">
              Where are you going?
            </ThemedText>
            <View style={[styles.searchGo, { backgroundColor: theme.brandFill }]}>
              <SymbolView
                name={{ ios: 'location.north.fill', android: 'navigation', web: 'navigation' }}
                size={20}
                tintColor={theme.onBrand}
              />
            </View>
          </Pressable>

          <View style={styles.chipRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change vehicle"
              onPress={() => router.push('/garage')}
              style={[styles.vehicleChip, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
              <SymbolView
                name={{ ios: 'car.fill', android: 'directions_car', web: 'directions_car' }}
                size={18}
                tintColor={theme.brand}
              />
              <ThemedText style={styles.vehicleName} numberOfLines={1}>
                {vehicleProfile.year} {vehicleProfile.makeModel}
                <ThemedText style={styles.vehicleMpg} themeColor="textSecondary">
                  {' · '}
                  {vehicleProfile.mpg} MPG
                </ThemedText>
              </ThemedText>
              <SymbolView
                name={{ ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }}
                size={16}
                tintColor={theme.textSecondary}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Route preferences"
              onPress={() => router.push('/route-preferences')}
              style={[styles.prefChip, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
              <SymbolView
                name={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }}
                size={18}
                tintColor={theme.brand}
              />
              <ThemedText style={styles.vehicleName}>{prefs ? PRIORITY_LABEL[prefs.priority] : 'Balanced'}</ThemedText>
            </Pressable>
          </View>

          <View style={[styles.mapCard, { borderColor: theme.border }]}>
            <MapIllustration height={150} centerDot accessibilityLabel="Map of the area around you" />
          </View>

          {pendingTrip && (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/trip-summary')}
              style={[styles.pending, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
              <View style={[styles.pendingIcon, { backgroundColor: theme.warnBg }]}>
                <SymbolView
                  name={{ ios: 'clock', android: 'schedule', web: 'schedule' }}
                  size={20}
                  tintColor={theme.warnText}
                />
              </View>
              <View style={styles.pendingText}>
                <ThemedText style={styles.pendingTitle} numberOfLines={1}>
                  Back from {pendingTrip.destinationLabel}?
                </ThemedText>
                <ThemedText style={styles.pendingBody} themeColor="textSecondary">
                  {pendingTrip.savingsDollars > 0
                    ? `Confirm your trip to add an estimated ${formatUsd(pendingTrip.savingsDollars)}.`
                    : 'Confirm your trip to log it.'}
                </ThemedText>
              </View>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={18}
                tintColor={theme.textSecondary}
              />
            </Pressable>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open savings"
            onPress={() => router.push('/savings')}
            style={[styles.hero, { backgroundColor: theme.hero }]}>
            <View style={styles.heroTop}>
              <ThemedText style={[styles.heroLabel, { color: HERO_LABEL }]}>Total Savings</ThemedText>
              <View style={styles.heroTag}>
                <ThemedText style={[styles.heroTagText, { color: HERO_TAG_TEXT }]}>Estimated</ThemedText>
              </View>
            </View>
            <View style={styles.heroMiddle}>
              <ThemedText type="moneyXl" style={styles.heroMoney}>
                {formatUsd(totalSavings)}
              </ThemedText>
              <ThemedText type="small" style={{ color: HERO_LABEL }}>
                vs. standard routes · {tripCount} {tripCount === 1 ? 'trip' : 'trips'} optimized
              </ThemedText>
            </View>
            <View style={styles.heroTiles}>
              <HeroTile label="This month" value={formatUsd(summary?.monthSavingsDollars ?? 0)} />
              <HeroTile label="Fuel avoided" value={`${(summary?.totalSavingsGallons ?? 0).toFixed(1)} gal`} />
            </View>
          </Pressable>

          <View style={styles.tiles}>
            <ActionTile icon={{ ios: 'plus', android: 'add', web: 'add' }} label="Add vehicle" onPress={() => router.push('/add-vehicle')} />
            <ActionTile
              icon={{ ios: 'clock.arrow.circlepath', android: 'history', web: 'history' }}
              label="Trip history"
              onPress={() => router.push('/trip-history')}
            />
          </View>

          <View style={styles.recentSection}>
            <View style={styles.recentHeader}>
              <ThemedText type="heading">Recent trips</ThemedText>
              {trips.length > 0 && (
                <Pressable accessibilityRole="button" onPress={() => router.push('/trip-history')} style={styles.seeAll}>
                  <ThemedText style={[styles.seeAllText, { color: theme.brand }]}>See all</ThemedText>
                </Pressable>
              )}
            </View>
            {recentTrips.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                No trips yet — plan a route to see it here.
              </ThemedText>
            ) : (
              <View style={[styles.tripList, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
                {recentTrips.map((trip, i) => (
                  <HomeTripRow key={trip.id} trip={trip} divider={i > 0} />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function HeroTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroTile}>
      <ThemedText style={[styles.heroTileLabel, { color: HERO_LABEL }]}>{label}</ThemedText>
      <ThemedText style={styles.heroTileValue}>{value}</ThemedText>
    </View>
  );
}

function ActionTile({
  icon,
  label,
  onPress,
}: {
  icon: SymbolViewProps['name'];
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.tile, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
      <View style={[styles.tileIcon, { backgroundColor: theme.tintBg }]}>
        <SymbolView name={icon} size={20} tintColor={theme.brand} />
      </View>
      <ThemedText style={styles.tileLabel}>{label}</ThemedText>
    </Pressable>
  );
}

function HomeTripRow({ trip, divider }: { trip: TripHistoryEntry; divider: boolean }) {
  const theme = useTheme();
  const saved = trip.savingsDollars;
  const hasSaving = saved != null;
  const savedColor = hasSaving && saved < 0 ? theme.warnText : theme.success;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/trip-detail', params: { id: trip.id } })}
      style={[styles.tripRow, divider && { borderTopWidth: 1, borderTopColor: theme.border }]}>
      <View style={[styles.tripIcon, { backgroundColor: theme.backgroundElement }]}>
        <SymbolView
          name={{ ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' }}
          size={18}
          tintColor={theme.textSecondary}
        />
      </View>
      <View style={styles.tripText}>
        <ThemedText style={styles.tripDest} numberOfLines={1}>
          {trip.destinationLabel}
        </ThemedText>
        <ThemedText style={styles.tripMeta} themeColor="textSecondary">
          {formatRelativeTripDate(trip.createdAt)} · {trip.distanceMiles.toFixed(1)} mi
        </ThemedText>
      </View>
      <View style={styles.tripRight}>
        <ThemedText style={[styles.tripSaved, { color: hasSaving ? savedColor : theme.textSecondary }]}>
          {hasSaving ? formatSignedUsd(saved) : formatUsd(trip.estimatedCost)}
        </ThemedText>
        <ThemedText style={styles.tripStatus} themeColor="textSecondary">
          Confirmed
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerText: { flexShrink: 1, gap: 2 },
  dateLabel: { fontFamily: InterFont.medium, fontSize: 13 },
  greeting: {
    fontFamily: InterFont.extrabold,
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.025 * 26,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: InterFont.bold, fontSize: 15 },

  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 60,
    paddingLeft: 18,
    paddingRight: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  searchPlaceholder: { flex: 1, fontFamily: InterFont.medium, fontSize: 17 },
  searchGo: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },

  chipRow: { flexDirection: 'row', gap: 8 },
  vehicleChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  prefChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  mapCard: { height: 150, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  vehicleName: { flex: 1, fontFamily: InterFont.semibold, fontSize: 14 },
  vehicleMpg: { fontFamily: InterFont.medium, fontSize: 14 },

  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 72,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  pendingIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pendingText: { flex: 1, minWidth: 0, gap: 2 },
  pendingTitle: { fontFamily: InterFont.bold, fontSize: 15 },
  pendingBody: { fontFamily: InterFont.regular, fontSize: 13, lineHeight: 18 },

  hero: { gap: 18, padding: 20, borderRadius: 22 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLabel: { fontFamily: InterFont.semibold, fontSize: 14 },
  heroTag: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)' },
  heroTagText: { fontFamily: InterFont.semibold, fontSize: 11 },
  heroMiddle: { gap: 4 },
  heroMoney: { color: '#FFFFFF' },
  heroTiles: { flexDirection: 'row', gap: 10 },
  heroTile: { flex: 1, gap: 2, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: HERO_TILE },
  heroTileLabel: { fontFamily: InterFont.regular, fontSize: 12 },
  heroTileValue: { fontFamily: InterFont.bold, fontSize: 18, color: '#FFFFFF', fontVariant: ['tabular-nums'] },

  tiles: { flexDirection: 'row', gap: 12 },
  tile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 64,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  tileIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontFamily: InterFont.semibold, fontSize: 15 },

  recentSection: { gap: 10, paddingTop: 8 },
  recentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seeAll: { minHeight: 36, justifyContent: 'center' },
  seeAllText: { fontFamily: InterFont.semibold, fontSize: 14 },
  tripList: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 66,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  tripIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tripText: { flex: 1, minWidth: 0, gap: 2 },
  tripDest: { fontFamily: InterFont.semibold, fontSize: 15 },
  tripMeta: { fontFamily: InterFont.regular, fontSize: 12 },
  tripRight: { alignItems: 'flex-end', gap: 2 },
  tripStatus: { fontFamily: InterFont.semibold, fontSize: 11 },
  tripSaved: { fontFamily: InterFont.bold, fontSize: 15, fontVariant: ['tabular-nums'] },

});
