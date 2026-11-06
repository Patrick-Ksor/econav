import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, IconTile } from '@/components/empty-state';
import { FullPageLoader } from '@/components/full-page-loader';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { InterFont, MaxContentWidth } from '@/constants/theme';
import { useCurrentLocation } from '@/hooks/use-current-location';
import { useTheme } from '@/hooks/use-theme';
import { computeRouteCost, pickRecommended, timeValueThreshold } from '@/lib/cost-model';
import { formatUsd } from '@/lib/format';
import { RoutePreferences, RoutePriority } from '@/schemas/route-preferences';
import { DEFAULT_DEPRECIATION_PER_MILE } from '@/schemas/vehicle';
import { useGasPrice } from '@/services/gas-price';
import { useRoutePreferences, useSaveRoutePreferences } from '@/services/route-preferences';
import { useSaveVehicleProfile, useVehicleProfile } from '@/services/vehicle-profile';

// A representative trip so the preview reacts to every setting. Numbers come from the
// design handoff's sample; real trips use the routes the user searches for.
const SAMPLE_ROUTES = [
  { label: 'Cheapest', facts: { miles: 24.6, minutes: 41, tolls: 0 } },
  { label: 'Balanced', facts: { miles: 25.9, minutes: 33, tolls: 0 } },
  { label: 'Fastest', facts: { miles: 27.8, minutes: 29, tolls: 3.5 } },
];
const FALLBACK_GAS_PRICE = 3.29;
const FALLBACK_MPG = 30;

const PRIORITIES: { id: RoutePriority; label: string; help: string }[] = [
  {
    id: 'cost',
    label: 'Lowest cost',
    help: 'Always recommends the route with the lowest estimated trip cost, even if it takes much longer.',
  },
  {
    id: 'balance',
    label: 'Balance',
    help: 'Weighs money against time using your time value below. Recommended for most drivers.',
  },
  {
    id: 'fast',
    label: 'Fastest',
    help: 'Always recommends the quickest arrival. EcoNav still shows what each route costs.',
  },
];

export function RoutePreferencesScreen() {
  const { data: prefs, isPlaceholderData, isError, refetch } = useRoutePreferences();
  const { isLoading: isVehicleLoading } = useVehicleProfile();

  // A failed load must not fall through to the form: it would show defaults as if they were
  // the user's saved settings, and saving would overwrite the real ones.
  if (isError && isPlaceholderData) {
    return (
      <ThemedView style={styles.flex}>
        <SafeAreaView style={styles.flex}>
          <EmptyState
            illustration={
              <IconTile icon={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} tone="danger" />
            }
            title="Couldn't load your preferences"
            body="Check your connection and try again. Your saved settings haven't changed."
            actionLabel="Try again"
            onAction={() => refetch()}
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  // Wait for everything the form is initialised from. The form copies its starting values
  // once, so if the vehicle arrived later, saving would write defaults over the vehicle's
  // real fuel-price override and depreciation.
  if (!prefs || isPlaceholderData || isVehicleLoading) {
    return <FullPageLoader label="Loading preferences…" />;
  }
  return <PreferencesForm initial={prefs} />;
}

function parseDecimal(text: string): number | null {
  const value = Number(text.trim());
  return text.trim() !== '' && Number.isFinite(value) ? value : null;
}

function PreferencesForm({ initial }: { initial: RoutePreferences }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: vehicle } = useVehicleProfile();
  // Same regional lookup the compare screen uses, so "local average" matches what trips are priced with.
  const location = useCurrentLocation();
  const { data: gas } = useGasPrice(
    vehicle?.fuelGrade ?? 'regular',
    location.status === 'granted' ? { lat: location.coords.latitude, lng: location.coords.longitude } : undefined,
  );
  const savePrefs = useSaveRoutePreferences();
  const saveVehicle = useSaveVehicleProfile();

  const [priority, setPriority] = useState(initial.priority);
  const [rate, setRate] = useState(initial.timeValuePerHour);
  const [includeTolls, setIncludeTolls] = useState(initial.includeTolls);
  const vehicleDep = vehicle?.depreciationPerMile ?? DEFAULT_DEPRECIATION_PER_MILE;
  const [depText, setDepText] = useState(vehicleDep.toFixed(2));
  const [fuelOverride, setFuelOverride] = useState(vehicle?.gasPriceOverride != null);
  const [fuelText, setFuelText] = useState(
    (vehicle?.gasPriceOverride ?? gas?.pricePerGallon ?? FALLBACK_GAS_PRICE).toFixed(2),
  );
  const [error, setError] = useState<string | null>(null);
  // Opened by URL (or reloaded) there is no history to pop; Profile is the parent.
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

  const depreciation = parseDecimal(depText);
  const fuelPrice = parseDecimal(fuelText);
  const localPrice = gas?.pricePerGallon ?? FALLBACK_GAS_PRICE;
  const effectiveGas = fuelOverride && fuelPrice != null && fuelPrice > 0 ? fuelPrice : localPrice;

  // Preview recomputes from the in-progress (unsaved) values.
  const draft: RoutePreferences = { priority, timeValuePerHour: rate, includeTolls };
  const effectiveDep = depreciation != null && depreciation >= 0 && depreciation <= 5 ? depreciation : vehicleDep;
  const scored = SAMPLE_ROUTES.map((r) => ({
    ...r,
    cost: computeRouteCost(r.facts, { mpg: vehicle?.mpg ?? FALLBACK_MPG, gasPricePerGallon: effectiveGas, depreciationPerMile: effectiveDep }, draft),
  }));
  const rec = scored[pickRecommended(scored, priority)];
  const priorityHelp = PRIORITIES.find((p) => p.id === priority)!.help;

  const onSave = async () => {
    if (vehicle && (depreciation == null || depreciation < 0 || depreciation > 5)) {
      setError('Depreciation must be between $0.00 and $5.00 per mile.');
      return;
    }
    if (fuelOverride && (fuelPrice == null || fuelPrice <= 0)) {
      setError('Enter a fuel price greater than $0, or turn the override off.');
      return;
    }
    setError(null);
    try {
      await savePrefs.mutateAsync({
        priority,
        timeValuePerHour: rate,
        includeTolls,
      });
      if (vehicle) {
        // Fuel price override and depreciation are settings of the active vehicle.
        const nextOverride = fuelOverride ? fuelPrice : null;
        if (nextOverride !== vehicle.gasPriceOverride || Math.abs(effectiveDep - vehicleDep) > 0.0001) {
          await saveVehicle.mutateAsync({
            ...vehicle,
            gasPriceOverride: nextOverride,
            depreciationPerMile: effectiveDep,
            updatedAt: new Date().toISOString(),
          });
        }
      }
      goBack();
    } catch {
      setError("Couldn't save your preferences. Check your connection and try again.");
    }
  };

  const saving = savePrefs.isPending || saveVehicle.isPending;
  const card = { backgroundColor: theme.surfaceRaised, borderColor: theme.border };
  const inputBox = { borderColor: theme.border, backgroundColor: theme.surfaceRaised };

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}>
          <View style={styles.titleRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={goBack}
              style={styles.back}>
              <SymbolView
                name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
                size={22}
                tintColor={theme.text}
              />
            </Pressable>
            <ThemedText style={styles.title}>Route preferences</ThemedText>
          </View>

          <View style={[styles.preview, { backgroundColor: theme.hero }]}>
            <ThemedText style={styles.previewLabel}>On a typical trip, these settings pick</ThemedText>
            <View style={styles.previewRow}>
              <ThemedText style={styles.previewRoute}>{rec.label}</ThemedText>
              <ThemedText style={styles.previewMeta}>
                {formatUsd(rec.cost.total)} · {rec.facts.minutes} min
              </ThemedText>
            </View>
          </View>

          <View style={[styles.section, card]}>
            <ThemedText style={styles.sectionTitle}>What matters most?</ThemedText>
            <View
              accessibilityRole="radiogroup"
              style={[styles.segmented, { backgroundColor: theme.backgroundElement }]}>
              {PRIORITIES.map((p) => {
                const on = p.id === priority;
                return (
                  <Pressable
                    key={p.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => setPriority(p.id)}
                    style={[styles.segment, on && { backgroundColor: theme.surfaceRaised, boxShadow: '0 1px 3px rgba(15,23,42,0.12)' }]}>
                    <ThemedText style={[styles.segmentLabel, { color: on ? theme.brand : theme.textSecondary }]}>
                      {p.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.help}>
              {priorityHelp}
            </ThemedText>
          </View>

          <View style={[styles.section, card, priority !== 'balance' && styles.dimmed]}>
            <View style={styles.rateHeader}>
              <ThemedText style={styles.sectionTitle}>Value of your time</ThemedText>
              <ThemedText style={[styles.rateValue, { color: theme.brand }]}>
                ${rate}
                <ThemedText style={styles.rateUnit} themeColor="textSecondary">
                  /hr
                </ThemedText>
              </ThemedText>
            </View>
            <Slider
              accessibilityLabel="Value of your time in dollars per hour"
              minimumValue={0}
              maximumValue={100}
              step={1}
              value={rate}
              onValueChange={setRate}
              disabled={priority !== 'balance'}
              minimumTrackTintColor={theme.brandFill}
              maximumTrackTintColor={theme.border}
              thumbTintColor={theme.brandFill}
              style={styles.slider}
            />
            <View style={styles.rateScale}>
              <ThemedText style={styles.scaleLabel} themeColor="textSecondary">
                $0 · save every cent
              </ThemedText>
              <ThemedText style={styles.scaleLabel} themeColor="textSecondary">
                $100 · time is money
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.help}>
              A route that takes 4 extra minutes has to save at least{' '}
              <ThemedText type="smallBold">{formatUsd(timeValueThreshold(4, rate))}</ThemedText> to be
              recommended. This is a ranking score, not money you spend.
            </ThemedText>
          </View>

          <View style={[styles.section, card, styles.sectionTight]}>
            {vehicle && (
              <>
                <View style={styles.switchRow}>
                  <View style={styles.rowText}>
                    <ThemedText style={styles.sectionTitle}>Override fuel price</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {fuelOverride
                        ? 'Using your price for every trip'
                        : `Using local average · ${formatUsd(localPrice)}/gal`}
                    </ThemedText>
                  </View>
                  <Switch
                    accessibilityLabel="Override fuel price"
                    value={fuelOverride}
                    onValueChange={setFuelOverride}
                    trackColor={{ true: theme.brandFill, false: theme.border }}
                  />
                </View>
                {fuelOverride && (
                  <View style={[styles.fuelInput, inputBox]}>
                    <ThemedText themeColor="textSecondary">$</ThemedText>
                    <TextInput
                      accessibilityLabel="Fuel price per gallon"
                      value={fuelText}
                      onChangeText={setFuelText}
                      keyboardType="decimal-pad"
                      style={[styles.input, { color: theme.text }]}
                    />
                    <ThemedText type="small" themeColor="textSecondary">
                      /gal
                    </ThemedText>
                  </View>
                )}
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
              </>
            )}

            {vehicle && (
              <>
            <View style={styles.switchRow}>
              <View style={styles.rowText}>
                <ThemedText style={styles.sectionTitle}>Depreciation per mile</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Value {vehicle ? 'your active car loses' : 'your car loses'} each mile
                </ThemedText>
              </View>
              <View style={[styles.depInput, inputBox]}>
                <ThemedText themeColor="textSecondary">$</ThemedText>
                <TextInput
                  accessibilityLabel="Depreciation per mile"
                  value={depText}
                  onChangeText={setDepText}
                  keyboardType="decimal-pad"
                  style={[styles.input, { color: theme.text }]}
                />
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />

              </>
            )}

            <View style={styles.switchRow}>
              <View style={styles.rowText}>
                <ThemedText style={styles.sectionTitle}>Include tolls in trip cost</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {includeTolls ? 'Where toll prices are available' : 'Tolls ignored in totals'}
                </ThemedText>
              </View>
              <Switch
                accessibilityLabel="Include tolls in trip cost"
                value={includeTolls}
                onValueChange={setIncludeTolls}
                trackColor={{ true: theme.brandFill, false: theme.border }}
              />
            </View>
          </View>

          {error && (
            <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
              {error}
            </ThemedText>
          )}
        </ScrollView>

        <View
          style={[
            styles.footer,
            { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: 14 + insets.bottom },
          ]}>
          <View style={styles.footerInner}>
            <PrimaryButton label={saving ? 'Saving…' : 'Save preferences'} onPress={onSave} disabled={saving} />
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 16, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: InterFont.extrabold, fontSize: 20, lineHeight: 26, letterSpacing: -0.015 * 20 },

  preview: { gap: 6, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18 },
  previewLabel: { fontFamily: InterFont.semibold, fontSize: 12, color: '#BBF7D0' },
  previewRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  previewRoute: { fontFamily: InterFont.extrabold, fontSize: 20, color: '#FFFFFF' },
  previewMeta: { fontFamily: InterFont.semibold, fontSize: 15, color: '#DCFCE7', fontVariant: ['tabular-nums'] },

  section: { gap: 10, padding: 16, borderRadius: 18, borderWidth: 1 },
  sectionTight: { gap: 12 },
  dimmed: { opacity: 0.5 },
  sectionTitle: { fontFamily: InterFont.bold, fontSize: 15, lineHeight: 20 },
  help: { lineHeight: 20 },

  segmented: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 12 },
  segment: { flex: 1, height: 44, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segmentLabel: { fontFamily: InterFont.bold, fontSize: 13 },

  rateHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  rateValue: { fontFamily: InterFont.extrabold, fontSize: 20, fontVariant: ['tabular-nums'] },
  rateUnit: { fontFamily: InterFont.semibold, fontSize: 13 },
  slider: { width: '100%', height: 32 },
  rateScale: { flexDirection: 'row', justifyContent: 'space-between' },
  scaleLabel: { fontFamily: InterFont.regular, fontSize: 11 },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowText: { flex: 1, gap: 2 },
  divider: { height: 1 },
  fuelInput: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 48, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1 },
  depInput: { flexDirection: 'row', alignItems: 'center', gap: 2, width: 104, height: 44, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1 },
  input: { flex: 1, minWidth: 0, height: 40, fontFamily: InterFont.bold, fontSize: 16, padding: 0, outlineWidth: 0, outlineColor: 'transparent' },

  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 14, paddingHorizontal: 20, borderTopWidth: 1, alignItems: 'center' },
  footerInner: { width: '100%', maxWidth: MaxContentWidth },
});
