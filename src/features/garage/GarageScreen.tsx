import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, IconTile } from '@/components/empty-state';
import { FullPageLoader } from '@/components/full-page-loader';
import { InfoCallout } from '@/components/info-callout';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { InterFont, MaxContentWidth } from '@/constants/theme';
import { useBottomTabPadding } from '@/hooks/use-bottom-tab-padding';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCurrentLocation } from '@/hooks/use-current-location';
import { useTheme } from '@/hooks/use-theme';
import { formatUsd } from '@/lib/format';
import { GarageVehicle, VehicleFormValues } from '@/schemas/vehicle';
import { useActivateVehicle, useDeleteVehicle, useGarageVehicles } from '@/services/garage';
import { useGasPrice } from '@/services/gas-price';
import { useSaveVehicleProfile } from '@/services/vehicle-profile';

import { GasPriceField } from './GasPriceField';
import { VehicleForm } from './VehicleForm';

const FUEL_LABEL = { regular: 'Regular', premium: 'Premium', diesel: 'Diesel' } as const;

export function GarageScreen() {
  const theme = useTheme();
  const bottomPadding = useBottomTabPadding();
  const location = useCurrentLocation();
  const locationCoords =
    location.status === 'granted'
      ? { lat: location.coords.latitude, lng: location.coords.longitude }
      : undefined;
  const { data: vehicles, isLoading, isError } = useGarageVehicles();
  const saveVehicleProfile = useSaveVehicleProfile();
  const activate = useActivateVehicle();
  const remove = useDeleteVehicle();
  const [editing, setEditing] = useState(false);
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // `undefined` means "no local edit yet this session" — defer to the loaded vehicle's
  // value. Once the user edits it, the local value always wins.
  const [localOverride, setLocalOverride] = useState<number | null | undefined>(undefined);

  const list = vehicles ?? [];
  const active = list.find((v) => v.isActive);
  const pendingOverride = localOverride !== undefined ? localOverride : active?.gasPriceOverride ?? null;

  const handleSubmit = async (values: VehicleFormValues) => {
    if (!active) return;
    setActionError(null);
    try {
      await saveVehicleProfile.mutateAsync({
        ...values,
        gasPriceOverride: pendingOverride,
        depreciationPerMile: active.depreciationPerMile,
        updatedAt: new Date().toISOString(),
      });
      setEditing(false);
    } catch {
      // Keep the editor open with the user's changes so they can retry.
      setActionError("Couldn't save your changes. Try again.");
    }
  };

  const handleOverrideChange = (value: number | null) => {
    setLocalOverride(value);
    if (active) {
      saveVehicleProfile.mutate({ ...active, gasPriceOverride: value, updatedAt: new Date().toISOString() });
    }
  };

  const run = async (action: () => Promise<unknown>, failure: string) => {
    setActionError(null);
    try {
      await action();
    } catch {
      setActionError(failure);
    }
  };

  const switchToVehicle = (v: GarageVehicle) =>
    run(async () => {
      await activate.mutateAsync(v.id);
      setLocalOverride(undefined);
    }, "Couldn't switch vehicles. Try again.");

  // Editing always works on the active vehicle, so a non-active one is switched to first.
  const startEdit = (v: GarageVehicle) =>
    run(async () => {
      if (!v.isActive) {
        await activate.mutateAsync(v.id);
        setLocalOverride(undefined);
      }
      setEditing(true);
    }, "Couldn't open that vehicle. Try again.");

  const confirmRemove = (v: GarageVehicle) =>
    run(async () => {
      await remove.mutateAsync(v.id);
      setConfirmingRemoveId(null);
      setEditing(false);
      setLocalOverride(undefined);
    }, "Couldn't remove that vehicle. Try again.");

  if (isLoading) {
    return <FullPageLoader label="Loading your garage…" />;
  }

  if (list.length === 0 && !isError) {
    return (
      <ThemedView style={styles.flex}>
        <SafeAreaView style={styles.flex} edges={['top']}>
          <View style={styles.emptyHeading}>
            <ThemedText type="title">Garage</ThemedText>
          </View>
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

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 24 }]}>
          <View style={styles.headerRow}>
            <View style={styles.heading}>
              <ThemedText type="title">Garage</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
                {list.length} {list.length === 1 ? 'vehicle' : 'vehicles'} · costs update every trip
              </ThemedText>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/add-vehicle')}
              style={[styles.addButton, { backgroundColor: theme.brandFill }]}>
              <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={18} tintColor={theme.onBrand} />
              <ThemedText style={[styles.addLabel, { color: theme.onBrand }]}>Add Vehicle</ThemedText>
            </Pressable>
          </View>

          {isError && (
            <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
              Couldn&apos;t load your garage. Check your connection and reload.
            </ThemedText>
          )}
          {actionError && (
            <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
              {actionError}
            </ThemedText>
          )}

          {list.map((v) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              location={locationCoords}
              editing={editing && v.isActive}
              confirmingRemove={confirmingRemoveId === v.id}
              busy={activate.isPending || remove.isPending}
              onUse={() => switchToVehicle(v)}
              onEdit={() => (editing && v.isActive ? setEditing(false) : startEdit(v))}
              onAskRemove={() => setConfirmingRemoveId(v.id)}
              onCancelRemove={() => setConfirmingRemoveId(null)}
              onConfirmRemove={() => confirmRemove(v)}
            />
          ))}

          {editing && active && (
            <View style={[styles.formCard, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
              <ThemedText type="heading">Edit {active.makeModel}</ThemedText>
              <VehicleForm
                key={active.id}
                defaultValues={active}
                submitLabel="Save changes"
                onSubmit={handleSubmit}
                renderGasPriceField={(fuelGrade) => (
                  <GasPriceField
                    fuelGrade={fuelGrade}
                    override={pendingOverride}
                    onOverrideChange={handleOverrideChange}
                    location={locationCoords}
                  />
                )}
              />
            </View>
          )}

          <InfoCallout>
            The selected vehicle&apos;s MPG, gas price and depreciation set your route costs and savings.
          </InfoCallout>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function VehicleCard({
  vehicle,
  location,
  editing,
  confirmingRemove,
  busy,
  onUse,
  onEdit,
  onAskRemove,
  onCancelRemove,
  onConfirmRemove,
}: {
  vehicle: GarageVehicle;
  location?: { lat: number; lng: number };
  editing: boolean;
  confirmingRemove: boolean;
  busy: boolean;
  onUse: () => void;
  onEdit: () => void;
  onAskRemove: () => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
}) {
  const theme = useTheme();
  const isDark = useColorScheme() === 'dark';
  const { data: gas } = useGasPrice(vehicle.fuelGrade, location);

  const [make, ...modelParts] = vehicle.makeModel.split(' ');
  const model = modelParts.join(' ');
  const gasPrice = vehicle.gasPriceOverride ?? gas?.pricePerGallon;
  const costPerMile = gasPrice != null ? gasPrice / vehicle.mpg + vehicle.depreciationPerMile : null;

  return (
    <View
      style={[
        styles.vehicleCard,
        {
          backgroundColor: theme.surfaceRaised,
          borderColor: vehicle.isActive ? theme.brand : theme.border,
          borderWidth: vehicle.isActive ? 2 : 1,
          boxShadow: vehicle.isActive ? (isDark ? '0 10px 28px rgba(0,0,0,0.35)' : '0 10px 28px rgba(20,83,45,0.12)') : undefined,
        },
      ]}>
      <View style={styles.vehicleHead}>
        <View style={[styles.initials, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText style={styles.initialsText} themeColor="textSecondary">
            {make.slice(0, 2).toUpperCase()}
          </ThemedText>
        </View>
        <View style={styles.vehicleNames}>
          <ThemedText style={styles.vehicleMake} themeColor="textSecondary">
            {vehicle.year} {make}
          </ThemedText>
          <ThemedText style={styles.vehicleModel} numberOfLines={1}>
            {model || make}
          </ThemedText>
        </View>
        {vehicle.isActive ? (
          <View style={[styles.selectedBadge, { backgroundColor: theme.tintBg }]}>
            <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={12} tintColor={theme.brand} />
            <ThemedText style={[styles.selectedText, { color: theme.brand }]}>Selected</ThemedText>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onUse}
            style={[styles.useButton, { borderColor: theme.border, backgroundColor: theme.surfaceRaised, opacity: busy ? 0.6 : 1 }]}>
            <ThemedText style={styles.useLabel}>Use this car</ThemedText>
          </Pressable>
        )}
      </View>

      <View style={styles.statGrid}>
        <Stat label="Fuel type" value={FUEL_LABEL[vehicle.fuelGrade]} />
        <Stat label="Combined" value={`${vehicle.mpg} MPG`} />
        <Stat label="Fuel price" value={gasPrice != null ? `${formatUsd(gasPrice)}/gal` : '—'} />
        <Stat label="Depreciation" value={`${formatUsd(vehicle.depreciationPerMile)}/mi`} />
      </View>

      {confirmingRemove ? (
        <View style={[styles.confirm, { borderTopColor: theme.border }]}>
          <ThemedText style={styles.confirmTitle}>Remove this vehicle?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            It leaves your garage. Trips you already confirmed are kept.
          </ThemedText>
          <View style={styles.confirmActions}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancelRemove}
              style={[styles.confirmButton, { borderColor: theme.border, backgroundColor: theme.background }]}>
              <ThemedText style={styles.confirmLabel}>Keep</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onConfirmRemove}
              style={[styles.confirmButton, { borderColor: theme.dangerBorder, backgroundColor: theme.background, opacity: busy ? 0.6 : 1 }]}>
              <ThemedText style={[styles.confirmLabel, { color: theme.danger }]}>Remove</ThemedText>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={[styles.cardFoot, { borderTopColor: theme.border }]}>
          <ThemedText style={styles.cpmLabel} themeColor="textSecondary">
            Est. cost per mile{'  '}
            <ThemedText style={styles.cpmValue}>{costPerMile != null ? formatUsd(costPerMile) : '—'}</ThemedText>
          </ThemedText>
          <View style={styles.iconButtons}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={editing ? 'Close editor' : `Edit ${vehicle.makeModel}`}
              onPress={onEdit}
              style={styles.iconButton}>
              <SymbolView
                name={
                  editing
                    ? { ios: 'xmark', android: 'close', web: 'close' }
                    : { ios: 'pencil', android: 'edit', web: 'edit' }
                }
                size={20}
                tintColor={theme.text}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${vehicle.makeModel}`}
              onPress={onAskRemove}
              style={styles.iconButton}>
              <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} size={20} tintColor={theme.danger} />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: theme.background }]}>
      <ThemedText style={styles.statLabel} themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, gap: 16, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  emptyHeading: { paddingHorizontal: 20, paddingTop: 16, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  heading: { flex: 1, gap: 2 },
  subtitle: { fontSize: 14 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 14, borderRadius: 14 },
  addLabel: { fontFamily: InterFont.bold, fontSize: 15 },

  vehicleCard: { gap: 14, padding: 16, borderRadius: 22 },
  vehicleHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  initials: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  initialsText: { fontFamily: InterFont.bold, fontSize: 14 },
  vehicleNames: { flex: 1, minWidth: 0, gap: 2 },
  vehicleMake: { fontFamily: InterFont.medium, fontSize: 12 },
  vehicleModel: { fontFamily: InterFont.bold, fontSize: 18, letterSpacing: -0.01 * 18 },
  selectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 9, borderRadius: 8 },
  selectedText: { fontFamily: InterFont.bold, fontSize: 12 },
  useButton: { height: 36, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, justifyContent: 'center' },
  useLabel: { fontFamily: InterFont.semibold, fontSize: 13 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { flexGrow: 1, flexBasis: '45%', gap: 2, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 },
  statLabel: { fontFamily: InterFont.medium, fontSize: 11 },
  statValue: { fontFamily: InterFont.bold, fontSize: 15 },

  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1 },
  cpmLabel: { fontFamily: InterFont.regular, fontSize: 13 },
  cpmValue: { fontFamily: InterFont.extrabold, fontSize: 15 },
  iconButtons: { flexDirection: 'row', gap: 4 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  confirm: { gap: 8, paddingTop: 12, borderTopWidth: 1 },
  confirmTitle: { fontFamily: InterFont.bold, fontSize: 15 },
  confirmActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  confirmButton: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  confirmLabel: { fontFamily: InterFont.bold, fontSize: 14 },

  formCard: { gap: 8, padding: 16, borderRadius: 22, borderWidth: 1 },
});
