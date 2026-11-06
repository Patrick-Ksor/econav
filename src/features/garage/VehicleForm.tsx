import { zodResolver } from '@hookform/resolvers/zod';
import { SymbolView } from 'expo-symbols';
import { ReactNode, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { VehicleFormSchema, VehicleFormValues } from '@/schemas/vehicle';

import { FuelGradeSelector } from './FuelGradeSelector';
import { MpgStepper } from './MpgStepper';
import { VehicleLookupModal } from './VehicleLookupModal';

interface VehicleFormProps {
  defaultValues?: Partial<VehicleFormValues>;
  onSubmit: (values: VehicleFormValues) => void;
  renderGasPriceField: (fuelGrade: VehicleFormValues['fuelGrade']) => ReactNode;
  submitLabel?: string;
}

export function VehicleForm({
  defaultValues,
  onSubmit,
  renderGasPriceField,
  submitLabel = 'Save vehicle',
}: VehicleFormProps) {
  const theme = useTheme();
  const [lookupVisible, setLookupVisible] = useState(false);
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(VehicleFormSchema),
    defaultValues: {
      year: '',
      makeModel: '',
      mpg: 33,
      fuelGrade: 'regular',
      ...defaultValues,
    },
  });
  const fuelGrade = useWatch({ control, name: 'fuelGrade' });
  const year = useWatch({ control, name: 'year' });
  const makeModel = useWatch({ control, name: 'makeModel' });
  const hasVehicle = !!year && !!makeModel;

  return (
    <View style={styles.container}>
      <VehicleLookupModal
        visible={lookupVisible}
        onClose={() => setLookupVisible(false)}
        onResolved={(result) => {
          setValue('year', result.year, { shouldValidate: true });
          setValue('makeModel', result.makeModel, { shouldValidate: true });
          setValue('mpg', result.mpg, { shouldValidate: true });
          setValue('fuelGrade', result.fuelGrade, { shouldValidate: true });
        }}
      />

      <ThemedText type="small" themeColor="textSecondary">
        Vehicle
      </ThemedText>
      {/* Year and make/model are only ever set via the EPA lookup below — no
          free-text entry — so the MPG this app calculates costs from is always
          backed by a real vehicle record, not a typo or a guess. */}
      <Pressable
        accessibilityRole="button"
        onPress={() => setLookupVisible(true)}
        style={[styles.vehicleField, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}>
        <View style={[styles.iconRow, styles.vehicleLabel]}>
          <SymbolView
            name={{ ios: 'car.fill', android: 'directions_car', web: 'directions_car' }}
            size={16}
            tintColor={theme.textSecondary}
          />
          <ThemedText
            type="default"
            numberOfLines={1}
            style={styles.vehicleLabelText}
            themeColor={hasVehicle ? 'text' : 'textTertiary'}>
            {hasVehicle ? `${year} ${makeModel}` : 'Search for your vehicle…'}
          </ThemedText>
        </View>
        <View style={[styles.iconRow, styles.vehicleAction]}>
          {hasVehicle && (
            <ThemedText type="smallBold" themeColor="tint">
              Change
            </ThemedText>
          )}
          <SymbolView
            name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            size={16}
            tintColor={theme.tint}
          />
        </View>
      </Pressable>
      {(errors.year ?? errors.makeModel) && (
        <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
          Search for your vehicle to continue.
        </ThemedText>
      )}

      <View style={styles.fieldSpacing}>
        <Controller
          control={control}
          name="mpg"
          render={({ field: { value, onChange } }) => <MpgStepper value={value} onChange={onChange} />}
        />
        {errors.mpg && (
          <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
            {errors.mpg.message}
          </ThemedText>
        )}
      </View>

      <ThemedText type="small" themeColor="textSecondary" style={styles.fieldSpacing}>
        Fuel Octane / Energy Grade
      </ThemedText>
      <Controller
        control={control}
        name="fuelGrade"
        render={({ field: { value, onChange } }) => (
          <FuelGradeSelector value={value} onChange={onChange} />
        )}
      />

      <View style={styles.fieldSpacing}>{renderGasPriceField(fuelGrade)}</View>

      <View style={styles.submit}>
        <PrimaryButton
          label={isSubmitting ? 'Saving…' : submitLabel}
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
        />
      </View>
      <ThemedText type="small" themeColor="textTertiary" style={styles.submitCaption}>
        You can update these details anytime.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.one },
  vehicleField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    minHeight: 52,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  // `numberOfLines={1}` on the label means it truncates with an ellipsis instead
  // of wrapping, so it's safe to let this side shrink all the way via `minWidth: 0`
  // — unlike a wrapping label, it can never collapse into one-character-per-line.
  vehicleLabel: { flex: 1, minWidth: 0 },
  vehicleLabelText: { flexShrink: 1 },
  vehicleAction: { flexShrink: 0 },
  fieldSpacing: { marginTop: Spacing.three },
  submit: { marginTop: Spacing.four },
  submitCaption: {
    textAlign: 'center',
    marginTop: Spacing.two,
  },
});
