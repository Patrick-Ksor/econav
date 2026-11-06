import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { EmptyState, IconTile } from '@/components/empty-state';
import { MapIllustration, MapRoute } from '@/components/map-illustration';
import { PrimaryButton, SecondaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { InterFont, PhoneColumnWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatUsd } from '@/lib/format';
import { formatDuration } from '@/lib/duration';
import { decodePolyline, sampleWaypoints } from '@/lib/polyline';
import { buildRouteOptions, explainRecommendation, formatArrival, RouteOption } from '@/lib/route-options';
import { useGasPrice } from '@/services/gas-price';
import { ExternalMapApp, isAppleMapsAvailable, openInExternalMap } from '@/services/map-launcher';
import { useRoutePreferences } from '@/services/route-preferences';
import { useVehicleProfile } from '@/services/vehicle-profile';
import { useTripStore } from '@/stores/trip-store';

import { useRouteComputation } from './use-route-computation';

const WAYPOINT_COUNT = 3;
const MAP_HEIGHT = 320;
const SHEET_OVERLAP = 24;
const WARN_CHIP_FG = '#92400E';

/** Step 2 of the trip flow: priced routes, why one is recommended, and how it's calculated. */
export function RouteCompareScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/routes'));
  const query = useTripStore((s) => s.lastRouteQuery);
  const setPendingTrip = useTripStore((s) => s.setPendingTrip);
  const { data: vehicle } = useVehicleProfile();
  const { data: prefs } = useRoutePreferences();
  const gasQuery = useGasPrice(vehicle?.fuelGrade ?? 'regular', query?.origin.location);
  const gasPrice = vehicle?.gasPriceOverride ?? gasQuery.data?.pricePerGallon;

  const {
    data: result,
    isLoading,
    isError,
    refetch,
  } = useRouteComputation({
    origin: query?.origin ?? null,
    destination: query?.destination ?? null,
    mpg: vehicle?.mpg ?? 0,
    pricePerGallon: gasPrice ?? 0,
  });

  // `null` follows the recommendation (which can change if preferences change).
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  const set = useMemo(
    () =>
      result && vehicle && prefs && gasPrice != null
        ? buildRouteOptions(result, { mpg: vehicle.mpg, gasPricePerGallon: gasPrice, depreciationPerMile: vehicle.depreciationPerMile }, prefs)
        : null,
    [result, vehicle, prefs, gasPrice],
  );

  const mapRoutes = useMemo<MapRoute[]>(() => {
    if (!set) return [];
    const selectedId = pickedId ?? set.options[set.recommendedIndex].id;
    return set.options
      .filter((o) => !!o.encodedPolyline)
      .map((o) => ({
        id: o.id,
        color: o.color,
        points: decodePolyline(o.encodedPolyline!),
        selected: o.id === selectedId,
        label: `${formatUsd(o.cost.total)} · ${Math.round(o.facts.minutes)} min`,
      }));
  }, [set, pickedId]);

  if (!query) {
    return (
      <ThemedView style={styles.flex}>
        <SafeAreaView style={[styles.flex, styles.center]}>
          <ThemedText type="heading">No trip planned yet</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerBody}>
            Pick a destination to compare routes.
          </ThemedText>
          <PrimaryButton label="Plan a trip" onPress={() => router.replace('/routes')} />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (isError) {
    return (
      <ThemedView style={styles.flex}>
        <SafeAreaView style={styles.flex} edges={['top']}>
          <EmptyState
            illustration={
              <IconTile icon={{ ios: 'location.slash.fill', android: 'location_off', web: 'location_off' }} tone="danger" />
            }
            title="We couldn't calculate routes"
            body="The routing service isn't responding. Your origin and destination are saved."
            actionLabel="Try again"
            onAction={() => refetch()}
            footer={
              <>
                <SecondaryButton
                  label="Open in Maps without comparing"
                  onPress={() =>
                    openInExternalMap('google', {
                      origin: query.origin.location,
                      destination: query.destination.location,
                    })
                  }
                />
                <Pressable accessibilityRole="button" onPress={goBack} style={styles.textButton}>
                  <ThemedText style={{ color: theme.brand, fontFamily: InterFont.semibold }}>Back</ThemedText>
                </Pressable>
              </>
            }
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (isLoading || !set || !vehicle || !prefs || !result) {
    return <RoutesLoading destination={query.destination.label} onBack={goBack} />;
  }

  const selected = set.options.find((o) => o.id === pickedId) ?? set.options[set.recommendedIndex];
  const recommended = set.options[set.recommendedIndex];
  const why = explainRecommendation(set, prefs);
  const savings = set.baseline.cost.total - selected.cost.total;

  const handleOpen = async (app: ExternalMapApp) => {
    setPendingTrip({
      originLabel: query.origin.label,
      destinationLabel: query.destination.label,
      routeLabel: selected.label,
      routeColor: selected.color,
      distanceMiles: selected.facts.miles,
      durationMinutes: selected.facts.minutes,
      cost: selected.cost.total,
      baselineCost: set.baseline.cost.total,
      baselineMinutes: set.baseline.facts.minutes,
      savingsDollars: savings,
      savingsGallons: set.baseline.gallons - selected.gallons,
      startedAt: new Date().toISOString(),
    });
    // Saved before launching: on web, opening the maps app can navigate the page away.
    const waypoints = selected.encodedPolyline
      ? sampleWaypoints(decodePolyline(selected.encodedPolyline), WAYPOINT_COUNT)
      : undefined;
    await openInExternalMap(app, {
      origin: result.origin.location,
      destination: result.destination.location,
      waypoints: app === 'google' ? waypoints : undefined,
    });
    router.push('/trip-summary');
  };

  return (
    <ThemedView style={styles.flex}>
      <View style={styles.mapWrap}>
        <MapIllustration
          height={MAP_HEIGHT}
          routes={mapRoutes}
          accessibilityLabel={`Map showing ${mapRoutes.length} route${mapRoutes.length === 1 ? '' : 's'} to ${query.destination.label}`}
        />
      </View>
      <ScrollView style={styles.flex} contentContainerStyle={{ paddingTop: MAP_HEIGHT - SHEET_OVERLAP }}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.background, paddingBottom: 168 + insets.bottom, minHeight: 700 },
          ]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          {gasQuery.data?.source === 'stub' && vehicle.gasPriceOverride == null && (
            <View style={[styles.banner, { backgroundColor: theme.warnBg, borderColor: theme.warnText }]}>
              <SymbolView
                name={{ ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' }}
                size={20}
                tintColor={theme.warnText}
              />
              <ThemedText style={[styles.bannerText, { color: theme.warnText }]}>
                Live fuel prices are unavailable. Using an estimate of{' '}
                <ThemedText style={[styles.bannerText, { color: theme.warnText, fontFamily: InterFont.bold }]}>
                  {formatUsd(gasPrice!)}/gal
                </ThemedText>
                .
              </ThemedText>
            </View>
          )}

          <View style={styles.heading}>
            <ThemedText style={styles.title}>Compare routes</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
              Leaving now · {formatArrival(0, now)} · {set.options.length} {set.options.length === 1 ? 'route' : 'routes'} found
            </ThemedText>
          </View>

          <View style={styles.chips}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/garage')}
              style={[styles.chip, styles.chipGrow, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
              <SymbolView
                name={{ ios: 'car.fill', android: 'directions_car', web: 'directions_car' }}
                size={18}
                tintColor={theme.brand}
              />
              <ThemedText style={styles.chipText} numberOfLines={1}>
                {vehicle.makeModel}
                <ThemedText style={styles.chipMuted} themeColor="textSecondary">
                  {'  ·  '}
                  {vehicle.mpg} MPG
                </ThemedText>
              </ThemedText>
              <ThemedText style={[styles.chipAction, { color: theme.brand }]}>Switch</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/route-preferences')}
              style={[styles.chip, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
              <SymbolView
                name={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }}
                size={18}
                tintColor={theme.brand}
              />
              <ThemedText style={styles.chipText}>
                {prefs.priority === 'balance'
                  ? `${formatUsd(prefs.timeValuePerHour).replace('.00', '')}/hr`
                  : prefs.priority === 'cost'
                    ? 'Lowest cost'
                    : 'Fastest'}
              </ThemedText>
            </Pressable>
          </View>

          <View accessibilityRole="radiogroup" style={styles.cards}>
            {set.options.map((o) => (
              <RouteCard
                key={o.id}
                option={o}
                other={set.options.find((x) => x.id !== o.id)}
                isRec={o.id === recommended.id && set.options.length > 1}
                isSelected={o.id === selected.id}
                arrive={formatArrival(o.facts.minutes, now)}
                why={o.id === recommended.id ? why : null}
                onPress={() => setPickedId(o.id)}
              />
            ))}
          </View>

          <Breakdown
            option={selected}
            options={set.options}
            recommendedId={recommended.id}
            mpg={vehicle.mpg}
            gasPrice={gasPrice!}
            depreciationPerMile={vehicle.depreciationPerMile}
            timeValuePerHour={prefs.timeValuePerHour}
            showScores={prefs.priority === 'balance'}
          />

          <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>
            Estimates use your vehicle&apos;s MPG, today&apos;s local fuel price and your depreciation setting. Toll
            prices aren&apos;t included. Real costs vary with traffic, weather and driving style.
          </ThemedText>
        </View>
      </ScrollView>

      <View style={[styles.topBarWrap, { top: insets.top + 8 }]}>
        <TopBar originLabel={query.origin.label} destinationLabel={query.destination.label} onBack={goBack} />
      </View>

        <View
          style={[
            styles.footer,
            { backgroundColor: theme.surfaceRaised, borderTopColor: theme.border, paddingBottom: 14 + insets.bottom },
          ]}>
          <View style={styles.footerInner}>
            <PrimaryButton label="Open in Maps" onPress={() => handleOpen('google')} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.footerNote}>
              Starts the {selected.label.toLowerCase()} route ({formatUsd(selected.cost.total)}) in Google Maps
            </ThemedText>
            <View style={styles.otherApps}>
              {isAppleMapsAvailable() && <OtherApp label="Apple Maps" onPress={() => handleOpen('apple')} />}
              <OtherApp label="Waze" onPress={() => handleOpen('waze')} />
            </View>
          </View>
        </View>
    </ThemedView>
  );
}

/** Skeleton shown while routes load: a progress bar and placeholder cards, as in the design. */
function RoutesLoading({ destination, onBack }: { destination: string; onBack: () => void }) {
  const theme = useTheme();
  const [slide] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(slide, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
    );
    loop.start();
    return () => loop.stop();
  }, [slide]);

  const bar = { backgroundColor: theme.backgroundElement };
  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.loadingWrap}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.loadingBack}>
            <SymbolView
              name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
              size={22}
              tintColor={theme.text}
            />
          </Pressable>
          <View style={[styles.mapSkeleton, bar]} />
          <ThemedText style={styles.loadingTitle}>Finding the best routes…</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Checking traffic and fuel prices on the way to {destination}.
          </ThemedText>
          <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  backgroundColor: theme.brandFill,
                  left: slide.interpolate({ inputRange: [0, 1], outputRange: ['-35%', '100%'] }),
                },
              ]}
            />
          </View>
          {[0, 1].map((i) => (
            <View key={i} style={[styles.skeletonCard, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
              <View style={[styles.skelBar, bar, { width: 90 }]} />
              <View style={styles.skelRow}>
                <View style={[styles.skelBar, bar, { width: 70, height: 22 }]} />
                <View style={[styles.skelBar, bar, { width: 70, height: 22 }]} />
              </View>
              <View style={[styles.skelBar, bar, { height: 44 }]} />
            </View>
          ))}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function OtherApp({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.otherApp}>
      <ThemedText style={{ color: theme.brand, fontFamily: InterFont.semibold, fontSize: 13 }}>
        Use {label} instead
      </ThemedText>
    </Pressable>
  );
}

function TopBar({
  originLabel,
  destinationLabel,
  onBack,
}: {
  originLabel: string;
  destinationLabel: string;
  onBack: () => void;
}) {
  const theme = useTheme();
  const shadow = useColorScheme() === 'dark' ? '0 4px 14px rgba(0,0,0,0.4)' : '0 4px 14px rgba(15,23,42,0.14)';
  return (
    <View style={styles.topBar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        style={[styles.roundBack, { backgroundColor: theme.surfaceRaised, boxShadow: shadow }]}>
        <SymbolView
          name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
          size={22}
          tintColor={theme.text}
        />
      </Pressable>
      <View style={[styles.pill, { backgroundColor: theme.surfaceRaised, boxShadow: shadow }]}>
        <ThemedText style={styles.pillFrom} themeColor="textSecondary" numberOfLines={1}>
          {originLabel}
        </ThemedText>
        <SymbolView
          name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
          size={14}
          tintColor={theme.textSecondary}
        />
        <ThemedText style={styles.pillTo} numberOfLines={1}>
          {destinationLabel}
        </ThemedText>
      </View>
    </View>
  );
}

function RouteCard({
  option,
  other,
  isRec,
  isSelected,
  arrive,
  why,
  onPress,
}: {
  option: RouteOption;
  other?: RouteOption;
  isRec: boolean;
  isSelected: boolean;
  arrive: string;
  why: string | null;
  onPress: () => void;
}) {
  const theme = useTheme();
  const isDark = useColorScheme() === 'dark';

  const costDiff = other ? other.cost.total - option.cost.total : 0;
  const minDiff = other ? Math.round(option.facts.minutes - other.facts.minutes) : 0;
  const chips: { text: string; tone: 'pos' | 'warn' | 'neutral' }[] = [];
  if (other && Math.abs(costDiff) >= 0.005) {
    chips.push({
      text: `${formatUsd(Math.abs(costDiff))} ${costDiff > 0 ? 'less' : 'more'} than ${other.label.toLowerCase()}`,
      tone: costDiff > 0 ? 'pos' : 'warn',
    });
  }
  if (other && minDiff !== 0) {
    chips.push({
      text: `${Math.abs(minDiff)} min ${minDiff > 0 ? 'longer' : 'faster'} than ${other.label.toLowerCase()}`,
      tone: minDiff > 0 && !isRec ? 'warn' : 'neutral',
    });
  }
  const chipColors = {
    pos: { bg: theme.tintBg, fg: theme.brand },
    warn: { bg: theme.warnBg, fg: isDark ? theme.warnText : WARN_CHIP_FG },
    neutral: { bg: theme.backgroundElement, fg: theme.textSecondary },
  };

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={`Select ${option.label} route`}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: theme.surfaceRaised,
          borderColor: isSelected ? theme.brand : theme.border,
          borderWidth: isSelected ? 2 : 1,
          boxShadow: isSelected ? '0 10px 28px rgba(20,83,45,0.14)' : '0 1px 2px rgba(15,23,42,0.04)',
        },
      ]}>
      <View style={styles.cardHead}>
        <View style={[styles.swatch, { backgroundColor: option.color }]} />
        <ThemedText style={styles.cardLabel}>{option.label}</ThemedText>
        {isRec && (
          <View style={[styles.recBadge, { backgroundColor: theme.tintBg }]}>
            <ThemedText style={[styles.recBadgeText, { color: theme.brand }]}>Recommended</ThemedText>
          </View>
        )}
        <View style={{ flex: 1 }} />
        <View
          style={[
            styles.radio,
            isSelected ? { backgroundColor: theme.brandFill } : { borderWidth: 2, borderColor: theme.border },
          ]}>
          {isSelected && (
            <SymbolView
              name={{ ios: 'checkmark', android: 'check', web: 'check' }}
              size={14}
              tintColor={theme.onBrand}
            />
          )}
        </View>
      </View>

      <View style={styles.cardMain}>
        <View style={styles.cardMainLeft}>
          <ThemedText style={styles.duration}>{formatDuration(option.facts.minutes)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {option.facts.miles.toFixed(1)} mi · Arrive {arrive}
          </ThemedText>
        </View>
        <View style={styles.cardMainRight}>
          <ThemedText style={[styles.total, { color: isRec ? theme.brand : theme.text }]}>
            {formatUsd(option.cost.total)}
          </ThemedText>
          <ThemedText style={styles.totalNote} themeColor="textSecondary">
            est. trip cost
          </ThemedText>
        </View>
      </View>

      {why && (
        <View style={[styles.why, { backgroundColor: theme.tintBg }]}>
          <SymbolView
            name={{ ios: 'info.circle', android: 'info', web: 'info' }}
            size={18}
            tintColor={theme.brand}
          />
          <ThemedText style={[styles.whyText, { color: theme.brand }]}>
            <ThemedText style={[styles.whyText, { color: theme.brand, fontFamily: InterFont.bold }]}>
              Why this route:{' '}
            </ThemedText>
            {why}
          </ThemedText>
        </View>
      )}

      <View style={styles.tiles}>
        <Tile label="Fuel" value={formatUsd(option.cost.fuel)} />
        <Tile label="Depreciation" value={formatUsd(option.cost.depreciation)} />
      </View>

      {chips.length > 0 && (
        <View style={styles.chipRow}>
          {chips.map((c) => (
            <View key={c.text} style={[styles.diffChip, { backgroundColor: chipColors[c.tone].bg }]}>
              <ThemedText style={[styles.diffChipText, { color: chipColors[c.tone].fg }]}>{c.text}</ThemedText>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: theme.background }]}>
      <ThemedText style={styles.tileLabel} themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.tileValue}>{value}</ThemedText>
    </View>
  );
}

function Breakdown({
  option,
  options,
  recommendedId,
  mpg,
  gasPrice,
  depreciationPerMile,
  timeValuePerHour,
  showScores,
}: {
  option: RouteOption;
  options: RouteOption[];
  recommendedId: string;
  mpg: number;
  gasPrice: number;
  depreciationPerMile: number;
  timeValuePerHour: number;
  showScores: boolean;
}) {
  const theme = useTheme();
  const miles = option.facts.miles.toFixed(1);
  const timeValue = (option.facts.minutes / 60) * timeValuePerHour;

  return (
    <View style={[styles.breakdown, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
      <View style={styles.breakdownHead}>
        <ThemedText type="heading" style={styles.breakdownTitle}>
          How {formatUsd(option.cost.total)} is calculated
        </ThemedText>
        <ThemedText style={styles.breakdownLabel} themeColor="textSecondary">
          {option.label}
        </ThemedText>
      </View>

      <BreakdownRow label="Fuel" formula={`${miles} mi ÷ ${mpg} MPG × ${formatUsd(gasPrice)}/gal`} value={formatUsd(option.cost.fuel)} />
      <BreakdownRow
        label="Depreciation"
        formula={`${miles} mi × ${formatUsd(depreciationPerMile)}/mi`}
        value={formatUsd(option.cost.depreciation)}
      />
      <View style={[styles.totalRow, { borderTopColor: theme.border }]}>
        <ThemedText style={styles.totalRowLabel}>Estimated trip cost</ThemedText>
        <ThemedText style={[styles.totalRowValue, { color: theme.brand }]}>{formatUsd(option.cost.total)}</ThemedText>
      </View>

      {showScores && (
        <View style={[styles.timeBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={styles.timeRow}>
            <ThemedText style={styles.timeLabel}>
              Time value
              <ThemedText style={styles.timeLabelMuted} themeColor="textSecondary">
                {'  ·  not money spent'}
              </ThemedText>
            </ThemedText>
            <ThemedText style={[styles.timeValue, { color: theme.textSecondary }]}>{formatUsd(timeValue)}</ThemedText>
          </View>
          <ThemedText style={styles.timeHelp} themeColor="textSecondary">
            {Math.round(option.facts.minutes)} min × {formatUsd(timeValuePerHour).replace('.00', '')}/hr ={' '}
            {formatUsd(timeValue)}. EcoNav adds this to the trip cost only to rank routes. Lowest score wins:
          </ThemedText>
          <View style={styles.scores}>
            {options.map((o) => (
              <View
                key={o.id}
                style={[
                  styles.score,
                  {
                    backgroundColor: theme.surfaceRaised,
                    borderColor: o.id === recommendedId ? theme.brand : theme.border,
                    borderWidth: o.id === recommendedId ? 2 : 1,
                  },
                ]}>
                <ThemedText style={styles.scoreLabel} themeColor="textSecondary">
                  {o.label}
                </ThemedText>
                <ThemedText style={styles.scoreValue}>{formatUsd(o.cost.score)}</ThemedText>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function BreakdownRow({ label, formula, value }: { label: string; formula: string; value: string }) {
  return (
    <View style={styles.bRow}>
      <View style={styles.bRowText}>
        <ThemedText style={styles.bRowLabel}>{label}</ThemedText>
        <ThemedText style={styles.bRowFormula} themeColor="textSecondary">
          {formula}
        </ThemedText>
      </View>
      <ThemedText style={styles.bRowValue}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { padding: 24, justifyContent: 'center', gap: 8 },
  centerBody: { marginBottom: 16 },
  textButton: { height: 48, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1 },
  bannerText: { flex: 1, fontFamily: InterFont.regular, fontSize: 14, lineHeight: 20 },
  loadingWrap: { flex: 1, width: '100%', maxWidth: PhoneColumnWidth, alignSelf: 'center', paddingHorizontal: 20, gap: 12 },
  loadingBack: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  mapSkeleton: { height: 200, borderRadius: 22 },
  loadingTitle: { fontFamily: InterFont.bold, fontSize: 20, marginTop: 4 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { position: 'absolute', top: 0, bottom: 0, width: '35%', borderRadius: 3 },
  skeletonCard: { gap: 12, padding: 16, borderRadius: 18, borderWidth: 1 },
  skelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  skelBar: { height: 14, borderRadius: 7 },
  mapWrap: { position: 'absolute', top: 0, left: 0, right: 0 },
  topBarWrap: { position: 'absolute', left: 16, right: 16, maxWidth: PhoneColumnWidth, alignSelf: 'center', width: '100%' },
  sheet: {
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxWidth: PhoneColumnWidth,
    width: '100%',
    alignSelf: 'center',
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3 },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roundBack: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pill: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 14, borderRadius: 22 },
  pillFrom: { fontFamily: InterFont.semibold, fontSize: 14, flexShrink: 0 },
  pillTo: { flex: 1, fontFamily: InterFont.semibold, fontSize: 14 },

  heading: { gap: 4, paddingHorizontal: 4 },
  title: { fontFamily: InterFont.extrabold, fontSize: 24, lineHeight: 30, letterSpacing: -0.025 * 24 },
  subtitle: { fontSize: 14 },

  chips: { flexDirection: 'row', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1 },
  chipGrow: { flex: 1, minWidth: 0 },
  chipText: { flexShrink: 1, fontFamily: InterFont.semibold, fontSize: 14 },
  chipMuted: { fontFamily: InterFont.medium, fontSize: 14 },
  chipAction: { marginLeft: 'auto', fontFamily: InterFont.bold, fontSize: 13 },

  cards: { gap: 12 },
  card: { gap: 14, padding: 16, borderRadius: 20 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 12, height: 12, borderRadius: 6 },
  cardLabel: { fontFamily: InterFont.bold, fontSize: 16 },
  recBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6 },
  recBadgeText: { fontFamily: InterFont.bold, fontSize: 11 },
  radio: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardMain: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  cardMainLeft: { gap: 2, flexShrink: 1 },
  cardMainRight: { alignItems: 'flex-end', gap: 2 },
  duration: { fontFamily: InterFont.extrabold, fontSize: 24, lineHeight: 27, letterSpacing: -0.02 * 24 },
  total: { fontFamily: InterFont.extrabold, fontSize: 26, lineHeight: 29, letterSpacing: -0.025 * 26, fontVariant: ['tabular-nums'] },
  totalNote: { fontFamily: InterFont.regular, fontSize: 12 },
  why: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 14 },
  whyText: { flex: 1, fontFamily: InterFont.regular, fontSize: 13, lineHeight: 19 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, gap: 2, padding: 10, borderRadius: 12 },
  tileLabel: { fontFamily: InterFont.medium, fontSize: 11 },
  tileValue: { fontFamily: InterFont.bold, fontSize: 15 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  diffChip: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: 8 },
  diffChipText: { fontFamily: InterFont.semibold, fontSize: 12 },

  breakdown: { gap: 12, padding: 18, borderRadius: 20, borderWidth: 1 },
  breakdownHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  breakdownTitle: { flex: 1, fontSize: 16 },
  breakdownLabel: { fontFamily: InterFont.semibold, fontSize: 12 },
  bRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  bRowText: { flex: 1, gap: 2 },
  bRowLabel: { fontFamily: InterFont.semibold, fontSize: 14 },
  bRowFormula: { fontFamily: InterFont.regular, fontSize: 12 },
  bRowValue: { fontFamily: InterFont.bold, fontSize: 14, fontVariant: ['tabular-nums'] },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1 },
  totalRowLabel: { fontFamily: InterFont.bold, fontSize: 14 },
  totalRowValue: { fontFamily: InterFont.extrabold, fontSize: 20, fontVariant: ['tabular-nums'] },
  timeBox: { gap: 8, marginTop: 4, padding: 12, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed' },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timeLabel: { fontFamily: InterFont.semibold, fontSize: 13 },
  timeLabelMuted: { fontFamily: InterFont.medium, fontSize: 13 },
  timeValue: { fontFamily: InterFont.bold, fontSize: 13, fontVariant: ['tabular-nums'] },
  timeHelp: { fontFamily: InterFont.regular, fontSize: 12, lineHeight: 17 },
  scores: { flexDirection: 'row', gap: 6 },
  score: { flex: 1, gap: 1, padding: 8, borderRadius: 10 },
  scoreLabel: { fontFamily: InterFont.regular, fontSize: 11 },
  scoreValue: { fontFamily: InterFont.bold, fontSize: 14, fontVariant: ['tabular-nums'] },

  disclaimer: { paddingHorizontal: 4, lineHeight: 18 },

  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 14, paddingHorizontal: 16, borderTopWidth: 1, alignItems: 'center' },
  footerInner: { width: '100%', maxWidth: PhoneColumnWidth, gap: 8 },
  footerNote: { textAlign: 'center', fontSize: 12 },
  otherApps: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  otherApp: { minHeight: 32, justifyContent: 'center' },
});
