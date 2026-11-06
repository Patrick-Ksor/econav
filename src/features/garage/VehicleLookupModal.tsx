import { useQueryClient } from '@tanstack/react-query';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ListRenderItemInfo,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { FuelGrade } from '@/schemas/vehicle';
import {
  fetchVehicleFuelDataRaw,
  useVehicleMakes,
  useVehicleModels,
  useVehicleTrims,
  useVehicleYears,
  VehicleTrimOption,
} from '@/services/fuel-economy';

export interface ResolvedVehicle {
  year: string;
  makeModel: string;
  mpg: number;
  fuelGrade: FuelGrade;
}

interface VehicleLookupModalProps {
  visible: boolean;
  onClose: () => void;
  onResolved: (result: ResolvedVehicle) => void;
}

type ResolveIssue = 'electric' | 'unavailable' | 'network';

const ISSUE_MESSAGE: Record<ResolveIssue, string> = {
  electric: "EcoNav doesn't support EV cost estimates yet — pick another trim or enter details manually.",
  unavailable: "No EPA fuel economy data for this trim — pick another trim or enter details manually.",
  network: "Couldn't reach fueleconomy.gov — try again.",
};

export function VehicleLookupModal({ visible, onClose, onResolved }: VehicleLookupModalProps) {
  const queryClient = useQueryClient();
  const [year, setYear] = useState<string | null>(null);
  const [make, setMake] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [trimId, setTrimId] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [issue, setIssue] = useState<ResolveIssue | null>(null);

  const yearsQuery = useVehicleYears();
  const makesQuery = useVehicleMakes(year);
  const modelsQuery = useVehicleModels(year, make);
  const trimsQuery = useVehicleTrims(year, make, model);

  const reset = () => {
    setYear(null);
    setMake(null);
    setModel(null);
    setTrimId(null);
    setIsResolving(false);
    setIssue(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSelectYear = (value: string) => {
    setYear(value);
    setMake(null);
    setModel(null);
    setTrimId(null);
    setIssue(null);
  };

  const handleSelectMake = (value: string) => {
    setMake(value);
    setModel(null);
    setTrimId(null);
    setIssue(null);
  };

  const handleSelectModel = (value: string) => {
    setModel(value);
    setTrimId(null);
    setIssue(null);
  };

  const handleSelectTrim = async (trim: VehicleTrimOption) => {
    setTrimId(trim.id);
    setIssue(null);
    setIsResolving(true);
    try {
      const fuelData = await queryClient.fetchQuery({
        queryKey: ['fuel-economy', 'fuel-data', trim.id],
        queryFn: () => fetchVehicleFuelDataRaw(trim.id),
        staleTime: Infinity,
      });
      if (fuelData.isElectric) {
        setIssue('electric');
        setIsResolving(false);
        return;
      }
      if (fuelData.mpg == null) {
        setIssue('unavailable');
        setIsResolving(false);
        return;
      }
      onResolved({ year: year!, makeModel: `${make} ${model}`, mpg: fuelData.mpg, fuelGrade: fuelData.fuelGrade });
      setIsResolving(false);
      reset();
      onClose();
    } catch {
      setIssue('network');
      setIsResolving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close" onPress={handleClose} />
        <ThemedView type="surfaceRaised" style={styles.card}>
          <View style={styles.headerRow}>
            <ThemedText type="default" style={styles.modalTitle}>Look Up Vehicle</ThemedText>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={handleClose} hitSlop={8}>
              <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={20} />
            </Pressable>
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            EPA fuel economy data — auto-fills your MPG and fuel grade.
          </ThemedText>

          <PickerStep
            label="Year"
            selected={year}
            options={yearsQuery.data ?? []}
            isLoading={yearsQuery.isLoading}
            isError={yearsQuery.isError}
            disabled={false}
            onSelect={handleSelectYear}
          />
          <PickerStep
            label="Make"
            selected={make}
            options={makesQuery.data ?? []}
            isLoading={makesQuery.isLoading}
            isError={makesQuery.isError}
            disabled={!year}
            onSelect={handleSelectMake}
          />
          <PickerStep
            label="Model"
            selected={model}
            options={modelsQuery.data ?? []}
            isLoading={modelsQuery.isLoading}
            isError={modelsQuery.isError}
            disabled={!make}
            onSelect={handleSelectModel}
          />
          <PickerStep
            label="Trim"
            selected={trimsQuery.data?.find((t) => t.id === trimId)?.label ?? null}
            options={(trimsQuery.data ?? []).map((t) => t.label)}
            isLoading={trimsQuery.isLoading}
            isError={trimsQuery.isError}
            disabled={!model}
            onSelect={(label) => {
              const trim = trimsQuery.data?.find((t) => t.label === label);
              if (trim) handleSelectTrim(trim);
            }}
          />

          {isResolving && (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" />
              <ThemedText type="small" themeColor="textSecondary">
                Looking up fuel economy…
              </ThemedText>
            </View>
          )}
          {issue && (
            <ThemedText type="small" themeColor="danger" accessibilityRole="alert" style={styles.statusRow}>
              {ISSUE_MESSAGE[issue]}
            </ThemedText>
          )}
        </ThemedView>
      </View>
    </Modal>
  );
}

interface PickerStepProps {
  label: string;
  selected: string | null;
  options: string[];
  isLoading: boolean;
  isError: boolean;
  disabled: boolean;
  onSelect: (value: string) => void;
}

function PickerStep({ label, selected, options, isLoading, isError, disabled, onSelect }: PickerStepProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState('');

  const filtered = filter.trim()
    ? options.filter((o) => o.toLowerCase().includes(filter.trim().toLowerCase()))
    : options;

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<string>) => (
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          onSelect(item);
          setExpanded(false);
          setFilter('');
        }}
        style={({ pressed }) => [styles.optionRow, pressed && styles.optionRowPressed]}>
        <ThemedText type="default">{item}</ThemedText>
      </Pressable>
    ),
    [onSelect],
  );

  return (
    <View style={styles.step}>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setExpanded((e) => !e)}
        style={[styles.stepHeader, { borderColor: theme.border }, disabled && styles.stepDisabled]}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        <View style={styles.stepValueRow}>
          {isLoading && <ActivityIndicator size="small" />}
          <ThemedText type="default" themeColor={selected ? 'text' : 'textTertiary'}>
            {selected ?? (disabled ? '—' : 'Select…')}
          </ThemedText>
          {!disabled && (
            <SymbolView
              name={{ ios: expanded ? 'chevron.up' : 'chevron.down', android: 'expand_more', web: 'expand_more' }}
              size={14}
              tintColor={theme.textTertiary}
            />
          )}
        </View>
      </Pressable>

      {expanded && !disabled && (
        <View style={[styles.optionsPanel, { borderColor: theme.border }]}>
          {isError && (
            <ThemedText type="small" themeColor="danger" style={styles.optionRow}>
              Couldn&apos;t load options — try again.
            </ThemedText>
          )}
          {!isError && options.length > 5 && (
            <TextInput
              value={filter}
              onChangeText={setFilter}
              placeholder={`Search ${label.toLowerCase()}…`}
              placeholderTextColor={theme.textTertiary}
              accessibilityLabel={`Search ${label}`}
              style={[styles.filterInput, { color: theme.text, borderColor: theme.border }]}
            />
          )}
          {!isError && (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item}
              renderItem={renderItem}
              style={styles.optionsList}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: MaxContentWidth * 0.6,
    maxHeight: '85%',
    borderRadius: Spacing.three,
    padding: Spacing.four,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  subtitle: { marginTop: Spacing.half, marginBottom: Spacing.three },
  step: { marginTop: Spacing.two },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  stepDisabled: { opacity: 0.4 },
  stepValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  optionsPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderTopWidth: 0,
    borderBottomLeftRadius: Spacing.two,
    borderBottomRightRadius: Spacing.two,
  },
  optionsList: { maxHeight: 220 },
  filterInput: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  optionRow: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  optionRowPressed: { opacity: 0.6 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.three,
  },
});
