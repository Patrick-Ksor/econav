import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { InterFont, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { LatLng } from '@/schemas/routing';
import { FuelGrade } from '@/schemas/vehicle';
import { useGasPrice } from '@/services/gas-price';

// Same half-up rounding as formatUsd, so $3.695 reads $3.70 here and everywhere else.
const PRICE_FORMAT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface GasPriceFieldProps {
  fuelGrade: FuelGrade;
  override: number | null;
  onOverrideChange: (value: number | null) => void;
  location?: LatLng;
}

export function GasPriceField({ fuelGrade, override, onOverrideChange, location }: GasPriceFieldProps) {
  const theme = useTheme();
  const { data, isLoading, isError } = useGasPrice(fuelGrade, location);

  const displayValue = override ?? data?.pricePerGallon;

  const caption = override != null
    ? null
    : data
      ? data.source === 'api'
        ? location
          ? 'EIA weekly regional average'
          : 'EIA weekly national average'
        : 'Estimated — no live source configured'
      : null;

  return (
    <View style={[styles.container, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}>
      <View style={styles.row}>
        <View style={styles.leftGroup}>
          <View style={[styles.iconBadge, { borderColor: theme.border, backgroundColor: theme.background }]}>
            <SymbolView
              name={{ ios: 'fuelpump.fill', android: 'local_gas_station', web: 'local_gas_station' }}
              size={14}
              tintColor={theme.text}
            />
          </View>
          <View style={styles.leftText}>
            <ThemedText type="smallBold">Estimated Local Gas</ThemedText>
            {caption && (
              <ThemedText type="small" themeColor="textTertiary">
                {caption}
              </ThemedText>
            )}
          </View>
        </View>

        <View style={styles.priceRow}>
          <ThemedText type="smallBold">$</ThemedText>
          <TextInput
            value={override != null ? String(override) : displayValue != null ? PRICE_FORMAT.format(displayValue) : ''}
            onChangeText={(text) => {
              const parsed = Number(text);
              onOverrideChange(text.trim() === '' || Number.isNaN(parsed) ? null : parsed);
            }}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={theme.textTertiary}
            accessibilityLabel="Gas price per gallon"
            style={[styles.priceInput, { color: theme.text }]}
          />
          <ThemedText type="small" themeColor="textSecondary">
            /gal
          </ThemedText>
        </View>
      </View>

      {isLoading && !override && (
        <ThemedText type="small" themeColor="textTertiary" style={styles.statusText}>
          Loading current price…
        </ThemedText>
      )}
      {isError && !override && (
        <ThemedText type="small" themeColor="danger" accessibilityRole="alert" style={styles.statusText}>
          Couldn&apos;t fetch a price estimate — enter one manually.
        </ThemedText>
      )}
      {override != null && (
        <Pressable accessibilityRole="button" onPress={() => onOverrideChange(null)} style={styles.statusText}>
          <ThemedText type="linkPrimary">Reset to estimated</ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 18,
    padding: Spacing.three,
  },
  // `flexWrap` lets the price drop to its own line on narrow screens instead of
  // squeezing the label — a bare `minWidth: 0` on the label would let it shrink
  // all the way to ~0px instead of stopping once there's no room left, wrapping
  // its text one character per line.
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexShrink: 1,
    minWidth: 190,
  },
  leftText: { gap: Spacing.half, flexShrink: 1 },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.half,
    flexShrink: 0,
  },
  priceInput: {
    fontFamily: InterFont.bold,
    fontSize: 20,
    width: 72,
    padding: 0,
    textAlign: 'right',
  },
  statusText: { marginTop: Spacing.two },
});
