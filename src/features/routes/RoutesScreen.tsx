import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { EmptyState, IconTile } from '@/components/empty-state';
import { FullPageLoader } from '@/components/full-page-loader';
import { MapIllustration } from '@/components/map-illustration';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { InterFont, PhoneColumnWidth, RouteColors } from '@/constants/theme';
import { useCurrentLocation } from '@/hooks/use-current-location';
import { useTheme } from '@/hooks/use-theme';
import { generateId } from '@/lib/id';
import { LatLng, PlaceSuggestion, RecentDestination } from '@/schemas/routing';
import { useVehicleProfile } from '@/services/vehicle-profile';
import { useTripStore } from '@/stores/trip-store';

import { DestinationField, PlaceRow, SuggestionList } from './DestinationSearch';
import { usePlaceDetails } from './use-destination-search';

interface ResolvedDestination {
  label: string;
  location: LatLng;
  placeId: string;
}

const SHEET_TOP = 300;

/** Step 1 of the trip flow: pick a destination over the map, then compare routes. */
export function RoutesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const shadow = useColorScheme() === 'dark' ? '0 12px 32px rgba(0,0,0,0.45)' : '0 12px 32px rgba(15,23,42,0.14)';
  // Deep-linking straight to /routes leaves nothing to go back to.
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));
  const location = useCurrentLocation();
  const originBias =
    location.status === 'granted'
      ? { lat: location.coords.latitude, lng: location.coords.longitude }
      : undefined;
  const { data: vehicleProfile, isLoading: isProfileLoading } = useVehicleProfile();
  const { recentDestinations, addRecentDestination, clearRecentDestinations, setLastRouteQuery } = useTripStore();

  // Stable per-visit token so a suggest+retrieve pair is billed as one Mapbox session.
  const [sessionToken] = useState(() => generateId());
  const [query, setQuery] = useState('');
  const [selectedSuggestion, setSelectedSuggestion] = useState<PlaceSuggestion | null>(null);
  const [manualDestination, setManualDestination] = useState<ResolvedDestination | null>(null);

  const {
    data: placeDetails,
    isFetching: isResolvingPlace,
    isError: isResolveError,
  } = usePlaceDetails(selectedSuggestion?.placeId ?? null, sessionToken);

  const destination: ResolvedDestination | null =
    manualDestination ??
    (selectedSuggestion && placeDetails
      ? { label: selectedSuggestion.primaryText, location: placeDetails.location, placeId: selectedSuggestion.placeId }
      : null);

  const canCompare = location.status === 'granted' && !!destination && !!vehicleProfile;
  const isSearching = query.trim().length > 2;

  const clearDestination = () => {
    setSelectedSuggestion(null);
    setManualDestination(null);
  };

  const handleSelectSuggestion = (suggestion: PlaceSuggestion) => {
    setManualDestination(null);
    setSelectedSuggestion(suggestion);
    setQuery('');
  };

  const handleSelectRecent = (recent: RecentDestination) => {
    setSelectedSuggestion(null);
    setManualDestination({ placeId: recent.placeId, label: recent.label, location: recent.location });
    setQuery('');
  };

  const handleCompare = () => {
    if (!canCompare || location.status !== 'granted' || !destination) return;

    addRecentDestination({
      placeId: destination.placeId,
      label: destination.label,
      location: destination.location,
      lastUsedAt: new Date().toISOString(),
    });
    setLastRouteQuery({
      origin: { label: 'Current location', location: { lat: location.coords.latitude, lng: location.coords.longitude } },
      destination: { label: destination.label, location: destination.location },
    });
    router.push('/route-compare');
  };

  if (isProfileLoading) {
    return <FullPageLoader label="Loading your garage…" />;
  }

  if (!vehicleProfile) {
    return (
      <ThemedView style={styles.flex}>
        <SafeAreaView style={[styles.flex, styles.emptyState]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} style={styles.back}>
            <SymbolView
              name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
              size={22}
              tintColor={theme.text}
            />
          </Pressable>
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

  const originText =
    location.status === 'loading'
      ? 'Locating…'
      : location.status === 'denied'
        ? 'Location permission denied'
        : 'Current location';

  return (
    <ThemedView style={styles.screen}>
     <View style={styles.column}>
      <View style={StyleSheet.absoluteFill}>
        <MapIllustration height={windowHeight} accessibilityLabel="Map of the area around your location" />
      </View>

      {/* Floating search card */}
      <View style={[styles.cardWrap, { top: insets.top + 8 }]}>
        <View style={[styles.searchCard, { backgroundColor: theme.surfaceRaised, boxShadow: shadow }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} style={styles.back}>
            <SymbolView
              name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
              size={24}
              tintColor={theme.text}
            />
          </Pressable>
          <View style={styles.fields}>
            <View style={[styles.originRow, { backgroundColor: theme.background }]}>
              <View style={styles.originDot}>
                <View style={[styles.originHalo, { backgroundColor: RouteColors.cheapest }]} />
                <View style={[styles.originCore, { backgroundColor: RouteColors.cheapest }]} />
              </View>
              <ThemedText
                style={[styles.originText, location.status === 'denied' && { color: theme.danger }]}
                numberOfLines={1}>
                {originText}
              </ThemedText>
            </View>

            {destination ? (
              <View
                style={[
                  styles.chosen,
                  { backgroundColor: theme.surfaceRaised, borderColor: theme.brand, boxShadow: `0 0 0 4px ${theme.tintBg}` },
                ]}>
                <SymbolView
                  name={{ ios: 'mappin', android: 'location_on', web: 'location_on' }}
                  size={16}
                  tintColor={theme.brand}
                />
                <ThemedText style={styles.chosenText} numberOfLines={1}>
                  {destination.label}
                </ThemedText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear destination"
                  onPress={clearDestination}
                  hitSlop={10}>
                  <SymbolView
                    name={{ ios: 'xmark', android: 'close', web: 'close' }}
                    size={18}
                    tintColor={theme.textSecondary}
                  />
                </Pressable>
              </View>
            ) : (
              <DestinationField value={query} onChange={setQuery} />
            )}
          </View>
        </View>
      </View>

      {/* Bottom sheet */}
      <View style={[styles.sheet, { top: SHEET_TOP, backgroundColor: theme.surfaceRaised, boxShadow: '0 -8px 28px rgba(15,23,42,0.10)' }]}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.sheetContent, { paddingBottom: 100 + insets.bottom }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          <View style={styles.sheetTop}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change vehicle"
              onPress={() => router.push('/garage')}
              style={[styles.vehiclePill, { borderColor: theme.border }]}>
              <SymbolView
                name={{ ios: 'car.fill', android: 'directions_car', web: 'directions_car' }}
                size={16}
                tintColor={theme.brand}
              />
              <ThemedText style={styles.vehiclePillText} numberOfLines={1}>
                {vehicleProfile.makeModel}
              </ThemedText>
              <ThemedText style={[styles.vehiclePillMuted, { color: theme.textSecondary }]}>
                {vehicleProfile.mpg} MPG
              </ThemedText>
            </Pressable>
          </View>

          {isResolvingPlace && (
            <ThemedText type="small" themeColor="textSecondary">
              Resolving location…
            </ThemedText>
          )}
          {isResolveError && (
            <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
              Couldn&apos;t resolve that destination — try another search.
            </ThemedText>
          )}

          {isSearching && !destination && (
            <View style={styles.section}>
              <ThemedText type="overline" themeColor="textSecondary">
                Suggestions
              </ThemedText>
              <SuggestionList
                query={query}
                sessionToken={sessionToken}
                locationBias={originBias}
                onSelect={handleSelectSuggestion}
              />
            </View>
          )}

          {recentDestinations.length > 0 && !isSearching && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText type="overline" themeColor="textSecondary">
                  Recent
                </ThemedText>
                <Pressable accessibilityRole="button" onPress={clearRecentDestinations} hitSlop={8}>
                  <ThemedText type="link" style={{ color: theme.brand }}>
                    Clear all
                  </ThemedText>
                </Pressable>
              </View>
              {recentDestinations.map((d) => (
                <PlaceRow key={d.placeId} icon="recent" primary={d.label} onPress={() => handleSelectRecent(d)} />
              ))}
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: theme.surfaceRaised, paddingBottom: 14 + insets.bottom }]}>
          <View style={styles.footerInner}>
            <PrimaryButton
              label="Compare routes"
              onPress={handleCompare}
              disabled={!canCompare}
              trailingIcon={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
            />
          </View>
        </View>
      </View>
     </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, alignItems: 'center' },
  column: { flex: 1, width: '100%', maxWidth: PhoneColumnWidth },
  back: { width: 44, height: 44, marginLeft: -4, alignItems: 'center', justifyContent: 'center' },

  cardWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  searchCard: {
    width: '100%',
    flexDirection: 'row',
    gap: 4,
    paddingTop: 8,
    paddingBottom: 12,
    paddingLeft: 4,
    paddingRight: 12,
    borderRadius: 22,
  },
  fields: { flex: 1, gap: 8, paddingTop: 4 },
  originRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingHorizontal: 12, borderRadius: 12 },
  originDot: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  originHalo: { position: 'absolute', width: 16, height: 16, borderRadius: 8, opacity: 0.2 },
  originCore: { width: 8, height: 8, borderRadius: 4 },
  originText: { flex: 1, fontFamily: InterFont.medium, fontSize: 15 },
  chosen: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 12, borderRadius: 12, borderWidth: 2 },
  chosenText: { flex: 1, fontFamily: InterFont.semibold, fontSize: 16 },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
  },
  sheetContent: { paddingHorizontal: 20, paddingTop: 10, gap: 16 },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3 },
  sheetTop: { flexDirection: 'row', justifyContent: 'flex-end' },
  vehiclePill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, maxWidth: '100%', paddingHorizontal: 12, borderRadius: 22, borderWidth: 1 },
  vehiclePillText: { flexShrink: 1, fontFamily: InterFont.semibold, fontSize: 13 },
  vehiclePillMuted: { fontFamily: InterFont.medium, fontSize: 13 },

  section: { gap: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },

  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 10, paddingHorizontal: 20, alignItems: 'center' },
  footerInner: { width: '100%' },

  emptyState: { flex: 1, padding: 20 },
});
