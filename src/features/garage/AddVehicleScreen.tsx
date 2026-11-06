import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { InterFont, MaxContentWidth } from '@/constants/theme';
import { useCurrentLocation } from '@/hooks/use-current-location';
import { useTheme } from '@/hooks/use-theme';
import { formatUsd } from '@/lib/format';
import { generateId } from '@/lib/id';
import { DEFAULT_DEPRECIATION_PER_MILE, FuelGrade } from '@/schemas/vehicle';
import {
  fetchVehicleFuelDataRaw,
  useVehicleMakes,
  useVehicleModels,
  useVehicleTrims,
  useVehicleYears,
  VehicleTrimOption,
} from '@/services/fuel-economy';
import { useGasPrice } from '@/services/gas-price';
import { useAddVehicle, useGarageVehicles } from '@/services/garage';

import { FuelGradeSelector } from './FuelGradeSelector';

type Level = 'year' | 'make' | 'model' | 'trim';
type Issue = 'electric' | 'unavailable' | 'network';

const STEP_LABELS = ['Vehicle', 'Details', 'Costs'];
const MAX_ROWS = 60;
const FALLBACK_GAS_PRICE = 3.49;
// Same half-up rounding as formatUsd, so $3.695 reads $3.70 here and everywhere else.
const PRICE_FORMAT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ISSUE_MESSAGE: Record<Issue, string> = {
  electric: "EcoNav doesn't support EV cost estimates yet. Pick another trim or enter details manually.",
  unavailable: 'No EPA fuel economy data for this trim. Pick another trim or enter details manually.',
  network: "Couldn't reach fueleconomy.gov. Try again.",
};

const parseNumber = (text: string): number | null => {
  const n = Number(text.trim());
  return text.trim() !== '' && Number.isFinite(n) ? n : null;
};

/**
 * Three-step vehicle setup from the design: find the vehicle (EPA lookup), confirm the
 * details, set the costs. Saving replaces the single vehicle profile and updates the
 * depreciation in route preferences.
 */
export function AddVehicleScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: garage = [] } = useGarageVehicles();
  const addVehicle = useAddVehicle();
  // New vehicles start from the active vehicle's depreciation, since that's the user's own estimate.
  const existing = garage.find((v) => v.isActive);
  const location = useCurrentLocation();

  const [step, setStep] = useState(1);
  // Step 1: EPA drill-down
  const [year, setYear] = useState<string | null>(null);
  const [make, setMake] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [trim, setTrim] = useState<VehicleTrimOption | null>(null);
  const [filter, setFilter] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [issue, setIssue] = useState<Issue | null>(null);
  // Step 2: manual entry fallback
  const [manual, setManual] = useState(false);
  const [manualYear, setManualYear] = useState('');
  const [manualName, setManualName] = useState('');
  const [fuelGrade, setFuelGrade] = useState<FuelGrade>('regular');
  // Step 3: costs
  const [mpgText, setMpgText] = useState('');
  const [priceText, setPriceText] = useState<string | null>(null);
  const [depText, setDepText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const level: Level = !year ? 'year' : !make ? 'make' : !model ? 'model' : 'trim';
  const yearsQuery = useVehicleYears();
  const makesQuery = useVehicleMakes(year);
  const modelsQuery = useVehicleModels(year, make);
  const trimsQuery = useVehicleTrims(year, make, model);

  const localGas = useGasPrice(
    fuelGrade,
    location.status === 'granted' ? { lat: location.coords.latitude, lng: location.coords.longitude } : undefined,
  ).data?.pricePerGallon;
  const localPrice = localGas ?? FALLBACK_GAS_PRICE;

  const vehicleYear = manual ? manualYear.trim() : year;
  const vehicleName = manual ? manualName.trim() : make && model ? `${make} ${model}` : '';

  const mpg = parseNumber(mpgText);
  const mpgValid = mpg != null && mpg >= 5 && mpg <= 150;
  const price = parseNumber(priceText ?? PRICE_FORMAT.format(localPrice));
  const priceValid = price != null && price > 0;
  const dep = parseNumber(depText ?? (existing?.depreciationPerMile ?? DEFAULT_DEPRECIATION_PER_MILE).toFixed(2));
  const depValid = dep != null && dep >= 0 && dep <= 5;

  const canContinue =
    step === 1
      ? !!trim && !isResolving
      : step === 2
        ? !!vehicleYear && /^\d{4}$/.test(vehicleYear) && !!vehicleName
        : mpgValid && priceValid && depValid;

  const levelData = {
    year: yearsQuery,
    make: makesQuery,
    model: modelsQuery,
    trim: trimsQuery,
  }[level];

  const resetFrom = (from: Level) => {
    if (from === 'year') setYear(null);
    if (from === 'year' || from === 'make') setMake(null);
    if (from !== 'trim') setModel(null);
    setTrim(null);
    setIssue(null);
    setFilter('');
  };

  const pick = (value: string) => {
    setFilter('');
    if (level === 'year') setYear(value);
    else if (level === 'make') setMake(value);
    else if (level === 'model') setModel(value);
  };

  const pickTrim = async (option: VehicleTrimOption) => {
    setTrim(option);
    setIssue(null);
    setIsResolving(true);
    try {
      const data = await queryClient.fetchQuery({
        queryKey: ['fuel-economy', 'fuel-data', option.id],
        queryFn: () => fetchVehicleFuelDataRaw(option.id),
        staleTime: Infinity,
      });
      if (data.isElectric) {
        setIssue('electric');
        setTrim(null);
      } else if (data.mpg == null) {
        setIssue('unavailable');
        setTrim(null);
      } else {
        setMpgText(String(data.mpg));
        setFuelGrade(data.fuelGrade);
      }
    } catch {
      setIssue('network');
      setTrim(null);
    } finally {
      setIsResolving(false);
    }
  };

  const goManual = () => {
    setManual(true);
    setStep(2);
  };

  const back = () => {
    if (step > 1) setStep(step - 1);
    else if (router.canGoBack()) router.back();
    else router.replace('/garage');
  };

  const onSave = async () => {
    if (!mpgValid || !priceValid || !depValid || mpg == null || price == null || dep == null) return;
    setError(null);
    try {
      await addVehicle.mutateAsync({
        id: generateId(),
        year: vehicleYear!,
        makeModel: vehicleName,
        mpg,
        fuelGrade,
        // Only treat the price as a custom override when it differs from the local average.
        gasPriceOverride: priceText !== null && Math.abs(price - localPrice) >= 0.01 ? price : null,
        depreciationPerMile: dep,
        updatedAt: new Date().toISOString(),
      });
      // First vehicle: straight to Home. Otherwise show the garage so the addition is visible.
      router.replace(existing ? '/garage' : '/home');
    } catch {
      setError("Couldn't save your vehicle. Check your connection and try again.");
    }
  };

  const saving = addVehicle.isPending;
  const rows =
    level === 'trim'
      ? []
      : ((levelData.data as string[] | undefined) ?? []).filter(
          (o) => !filter.trim() || o.toLowerCase().includes(filter.trim().toLowerCase()),
        );
  const trimRows = level === 'trim' ? ((trimsQuery.data as VehicleTrimOption[] | undefined) ?? []) : [];
  const card = { backgroundColor: theme.surfaceRaised, borderColor: theme.border };
  const input = { backgroundColor: theme.surfaceRaised, borderColor: theme.border, color: theme.text };

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}>
          <View style={styles.topRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={styles.back}>
              <SymbolView
                name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
                size={24}
                tintColor={theme.text}
              />
            </Pressable>
            <ThemedText style={styles.topTitle}>Add vehicle</ThemedText>
            <ThemedText style={styles.topStep} themeColor="textSecondary">
              {step}/3
            </ThemedText>
          </View>

          <View style={styles.bars} accessibilityLabel={`Step ${step} of 3`}>
            {STEP_LABELS.map((label, i) => (
              <View key={label} style={styles.barCol}>
                <View style={[styles.bar, { backgroundColor: i < step ? theme.brandFill : theme.border }]} />
                <ThemedText style={[styles.barLabel, { color: i < step ? theme.brand : theme.textSecondary }]}>
                  {label}
                </ThemedText>
              </View>
            ))}
          </View>

          {step === 1 && (
            <View style={styles.stepBody}>
              <View style={styles.heading}>
                <ThemedText style={styles.h1}>Find your vehicle</ThemedText>
                <ThemedText style={styles.lede} themeColor="textSecondary">
                  Pick year, make, model and trim. We&apos;ll prefill the fuel economy from EPA data.
                </ThemedText>
              </View>

              {(year || make || model) && (
                <View style={styles.crumbs}>
                  {[
                    { value: year, from: 'year' as const },
                    { value: make, from: 'make' as const },
                    { value: model, from: 'model' as const },
                  ]
                    .filter((c) => c.value)
                    .map((c) => (
                      <Pressable
                        key={c.from}
                        accessibilityRole="button"
                        accessibilityLabel={`Change ${c.from}`}
                        onPress={() => resetFrom(c.from)}
                        style={[styles.crumb, { backgroundColor: theme.tintBg }]}>
                        <ThemedText style={[styles.crumbText, { color: theme.brand }]}>{c.value}</ThemedText>
                        <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={12} tintColor={theme.brand} />
                      </Pressable>
                    ))}
                </View>
              )}

              {level !== 'trim' && (
                <View style={[styles.search, { backgroundColor: theme.surfaceRaised, borderColor: theme.brand, boxShadow: `0 0 0 4px ${theme.tintBg}` }]}>
                  <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={20} tintColor={theme.textSecondary} />
                  <TextInput
                    value={filter}
                    onChangeText={setFilter}
                    placeholder={`Search ${level === 'year' ? 'years' : level === 'make' ? 'makes' : 'models'}`}
                    placeholderTextColor={theme.textTertiary}
                    accessibilityLabel={`Search ${level}`}
                    style={[styles.searchInput, { color: theme.text }]}
                  />
                </View>
              )}

              <ThemedText type="overline" themeColor="textSecondary">
                {level === 'year' ? 'Year' : level === 'make' ? 'Make' : level === 'model' ? 'Model' : 'Trim'}
              </ThemedText>

              <View style={[styles.list, card]}>
                {levelData.isLoading && <ActivityIndicator style={styles.listStatus} />}
                {levelData.isError && (
                  <ThemedText type="small" style={[styles.listStatus, { color: theme.danger }]} accessibilityRole="alert">
                    Couldn&apos;t load options. Check your connection and try again.
                  </ThemedText>
                )}
                {level !== 'trim' &&
                  rows.slice(0, MAX_ROWS).map((value, i) => (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      onPress={() => pick(value)}
                      style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
                      <ThemedText style={styles.rowName}>{value}</ThemedText>
                      <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor={theme.textTertiary} />
                    </Pressable>
                  ))}
                {level === 'trim' &&
                  trimRows.map((option, i) => {
                    const on = trim?.id === option.id;
                    return (
                      <Pressable
                        key={option.id}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                        onPress={() => pickTrim(option)}
                        style={[
                          styles.row,
                          i > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                          on && { backgroundColor: theme.tintBg },
                        ]}>
                        <View style={styles.rowText}>
                          <ThemedText style={styles.rowName}>
                            {year} {make} {model}
                          </ThemedText>
                          <ThemedText style={styles.rowSpec} themeColor="textSecondary">
                            {option.label}
                          </ThemedText>
                        </View>
                        <View
                          style={[
                            styles.radio,
                            on ? { backgroundColor: theme.brandFill } : { borderWidth: 2, borderColor: theme.border },
                          ]}>
                          {on && <View style={[styles.radioDot, { backgroundColor: theme.onBrand }]} />}
                        </View>
                      </Pressable>
                    );
                  })}
                {!levelData.isLoading && !levelData.isError && level !== 'trim' && rows.length === 0 && (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.listStatus}>
                    No matches.
                  </ThemedText>
                )}
              </View>
              {level !== 'trim' && rows.length > MAX_ROWS && (
                <ThemedText type="small" themeColor="textSecondary">
                  Showing the first {MAX_ROWS}. Keep typing to narrow it down.
                </ThemedText>
              )}

              {isResolving && (
                <View style={styles.inline}>
                  <ActivityIndicator size="small" />
                  <ThemedText type="small" themeColor="textSecondary">
                    Looking up fuel economy…
                  </ThemedText>
                </View>
              )}
              {issue && (
                <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
                  {ISSUE_MESSAGE[issue]}
                </ThemedText>
              )}

              <Pressable accessibilityRole="button" onPress={goManual} style={styles.manual}>
                <ThemedText style={[styles.manualText, { color: theme.brand }]}>
                  Can&apos;t find it? Enter details manually
                </ThemedText>
              </Pressable>
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepBody}>
              <View style={styles.heading}>
                <ThemedText style={styles.h1}>Confirm the details</ThemedText>
                <ThemedText style={styles.lede} themeColor="textSecondary">
                  {manual ? 'Tell us about your vehicle.' : 'Check that this is your vehicle and its fuel type.'}
                </ThemedText>
              </View>

              {manual ? (
                <View style={styles.fields}>
                  <Field label="Year">
                    <TextInput
                      value={manualYear}
                      onChangeText={setManualYear}
                      keyboardType="number-pad"
                      maxLength={4}
                      placeholder="2021"
                      placeholderTextColor={theme.textTertiary}
                      accessibilityLabel="Year"
                      style={[styles.textField, input]}
                    />
                  </Field>
                  <Field label="Make and model">
                    <TextInput
                      value={manualName}
                      onChangeText={setManualName}
                      placeholder="Toyota RAV4"
                      placeholderTextColor={theme.textTertiary}
                      accessibilityLabel="Make and model"
                      style={[styles.textField, input]}
                    />
                  </Field>
                </View>
              ) : (
                <View style={[styles.summary, card]}>
                  <ThemedText style={styles.summaryYear} themeColor="textSecondary">
                    {year} {make}
                  </ThemedText>
                  <ThemedText style={styles.summaryModel}>{model}</ThemedText>
                  {trim && (
                    <ThemedText style={styles.rowSpec} themeColor="textSecondary">
                      {trim.label}
                    </ThemedText>
                  )}
                </View>
              )}

              <Field label="Fuel type">
                <FuelGradeSelector value={fuelGrade} onChange={setFuelGrade} />
              </Field>
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepBody}>
              <View style={styles.heading}>
                <ThemedText style={styles.h1}>Set your costs</ThemedText>
                <ThemedText style={styles.lede} themeColor="textSecondary">
                  {manual
                    ? 'Enter your fuel economy and adjust anything that does not match your driving.'
                    : `Prefilled for a ${vehicleYear} ${vehicleName}. Adjust anything that doesn't match your driving.`}
                </ThemedText>
              </View>

              <Field label="Combined MPG">
                <View
                  style={[
                    styles.unitField,
                    { backgroundColor: theme.surfaceRaised, borderColor: mpgText && !mpgValid ? theme.dangerBorder : theme.border, borderWidth: mpgText && !mpgValid ? 2 : 1 },
                  ]}>
                  <TextInput
                    value={mpgText}
                    onChangeText={setMpgText}
                    keyboardType="decimal-pad"
                    accessibilityLabel="Combined MPG"
                    style={[styles.unitInput, styles.unitInputBig, { color: theme.text }]}
                  />
                  <ThemedText style={styles.unit} themeColor="textSecondary">
                    MPG
                  </ThemedText>
                </View>
                <ThemedText
                  style={[styles.help, { color: mpgText && !mpgValid ? theme.danger : theme.textSecondary }]}>
                  {mpgText && !mpgValid
                    ? 'Enter an MPG between 5 and 150.'
                    : 'Prefilled estimate. Use your real-world average if you know it.'}
                </ThemedText>
              </Field>

              <View style={styles.twoCol}>
                <View style={styles.half}>
                  <Field label="Fuel price">
                    <View style={[styles.unitField, { backgroundColor: theme.surfaceRaised, borderColor: theme.border, borderWidth: 1 }]}>
                      <ThemedText style={styles.unit} themeColor="textSecondary">
                        $
                      </ThemedText>
                      <TextInput
                        value={priceText ?? PRICE_FORMAT.format(localPrice)}
                        onChangeText={setPriceText}
                        keyboardType="decimal-pad"
                        accessibilityLabel="Fuel price per gallon"
                        style={[styles.unitInput, { color: theme.text }]}
                      />
                      <ThemedText style={styles.unitSmall} themeColor="textSecondary">
                        /gal
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.help} themeColor="textSecondary">
                      Local average
                    </ThemedText>
                  </Field>
                </View>
                <View style={styles.half}>
                  <Field label="Depreciation">
                    <View style={[styles.unitField, { backgroundColor: theme.surfaceRaised, borderColor: theme.border, borderWidth: 1 }]}>
                      <ThemedText style={styles.unit} themeColor="textSecondary">
                        $
                      </ThemedText>
                      <TextInput
                        value={depText ?? (existing?.depreciationPerMile ?? DEFAULT_DEPRECIATION_PER_MILE).toFixed(2)}
                        onChangeText={setDepText}
                        keyboardType="decimal-pad"
                        accessibilityLabel="Depreciation per mile"
                        style={[styles.unitInput, { color: theme.text }]}
                      />
                      <ThemedText style={styles.unitSmall} themeColor="textSecondary">
                        /mi
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.help} themeColor="textSecondary">
                      For this vehicle
                    </ThemedText>
                  </Field>
                </View>
              </View>

              <View style={[styles.notice, { backgroundColor: theme.warnBg, borderColor: theme.warnText }]}>
                <SymbolView name={{ ios: 'info.circle', android: 'info', web: 'info' }} size={18} tintColor={theme.warnText} />
                <ThemedText style={[styles.noticeText, { color: theme.warnText }]}>
                  MPG and depreciation are estimates. Real-world costs vary with traffic, weather, load and how you drive.
                  You can change these any time.
                </ThemedText>
              </View>

              {existing && (
                <ThemedText type="small" themeColor="textSecondary">
                  This is added to your garage and becomes your active vehicle. Your {existing.year}{' '}
                  {existing.makeModel} stays in your garage.
                </ThemedText>
              )}
              {mpgValid && priceValid && depValid && (
                <ThemedText type="small" themeColor="textSecondary">
                  Estimated cost per mile: {formatUsd(price! / mpg! + dep!)}
                </ThemedText>
              )}
              {error && (
                <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
                  {error}
                </ThemedText>
              )}
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: theme.background, paddingBottom: 14 + insets.bottom }]}>
          <View style={styles.footerInner}>
            {step < 3 ? (
              <PrimaryButton label="Continue" onPress={() => setStep(step + 1)} disabled={!canContinue} />
            ) : (
              <PrimaryButton label={saving ? 'Saving…' : 'Save vehicle'} onPress={onSave} disabled={!canContinue || saving} />
            )}
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText style={styles.fieldLabel}>{label}</ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 18, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: InterFont.bold, fontSize: 16 },
  topStep: { width: 44, textAlign: 'right', fontFamily: InterFont.semibold, fontSize: 13 },
  bars: { flexDirection: 'row', gap: 6 },
  barCol: { flex: 1, gap: 6 },
  bar: { height: 4, borderRadius: 2 },
  barLabel: { fontFamily: InterFont.semibold, fontSize: 11 },

  stepBody: { gap: 14 },
  heading: { gap: 4 },
  h1: { fontFamily: InterFont.extrabold, fontSize: 24, lineHeight: 30, letterSpacing: -0.02 * 24 },
  lede: { fontFamily: InterFont.regular, fontSize: 14, lineHeight: 21 },

  crumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  crumb: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 18 },
  crumbText: { fontFamily: InterFont.semibold, fontSize: 13 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingHorizontal: 14, borderRadius: 14, borderWidth: 2 },
  searchInput: { flex: 1, minWidth: 0, height: 44, padding: 0, fontFamily: InterFont.semibold, fontSize: 16, outlineWidth: 0, outlineColor: 'transparent' },

  list: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  listStatus: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10, paddingHorizontal: 14 },
  rowText: { flex: 1, gap: 2 },
  rowName: { flex: 1, fontFamily: InterFont.bold, fontSize: 15 },
  rowSpec: { fontFamily: InterFont.regular, fontSize: 12 },
  radio: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  manual: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  manualText: { fontFamily: InterFont.semibold, fontSize: 14 },

  fields: { gap: 14 },
  field: { gap: 6 },
  fieldLabel: { fontFamily: InterFont.semibold, fontSize: 13 },
  textField: { height: 48, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, fontFamily: InterFont.medium, fontSize: 15, outlineWidth: 0, outlineColor: 'transparent' },
  summary: { gap: 2, padding: 16, borderRadius: 18, borderWidth: 1 },
  summaryYear: { fontFamily: InterFont.medium, fontSize: 13 },
  summaryModel: { fontFamily: InterFont.extrabold, fontSize: 22, letterSpacing: -0.01 * 22 },

  unitField: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 52, paddingHorizontal: 12, borderRadius: 12 },
  unitInput: { flex: 1, minWidth: 0, height: 44, padding: 0, fontFamily: InterFont.bold, fontSize: 17, outlineWidth: 0, outlineColor: 'transparent' },
  unitInputBig: { paddingLeft: 2 },
  unit: { fontFamily: InterFont.medium, fontSize: 16 },
  unitSmall: { fontFamily: InterFont.regular, fontSize: 13 },
  help: { fontFamily: InterFont.regular, fontSize: 12, lineHeight: 17 },
  twoCol: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  notice: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1 },
  noticeText: { flex: 1, fontFamily: InterFont.regular, fontSize: 13, lineHeight: 19 },

  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 14, paddingHorizontal: 20, alignItems: 'center' },
  footerInner: { width: '100%', maxWidth: MaxContentWidth },
});
