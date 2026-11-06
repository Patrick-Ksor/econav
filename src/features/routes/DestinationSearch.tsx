import { SymbolView } from 'expo-symbols';
import { memo, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { InterFont } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { LatLng, PlaceSuggestion } from '@/schemas/routing';

import { useDestinationSearch } from './use-destination-search';

/** One place row: pin badge, bold name, secondary address. `highlighted` is the top match. */
export const PlaceRow = memo(function PlaceRow({
  primary,
  secondary,
  icon = 'pin',
  highlighted,
  onPress,
}: {
  primary: string;
  secondary?: string;
  icon?: 'pin' | 'recent';
  highlighted?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.row, highlighted && { backgroundColor: theme.tintBg, marginHorizontal: -12, paddingHorizontal: 12 }]}>
      <View
        style={[
          styles.rowIcon,
          { backgroundColor: highlighted ? theme.tintBg : theme.backgroundElement },
          icon === 'recent' && styles.rowIconBare,
        ]}>
        <SymbolView
          name={
            icon === 'pin'
              ? { ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' }
              : { ios: 'clock', android: 'schedule', web: 'schedule' }
          }
          size={icon === 'pin' ? 18 : 20}
          tintColor={highlighted ? theme.brand : theme.textSecondary}
        />
      </View>
      <View style={styles.rowText}>
        <ThemedText style={styles.rowPrimary} numberOfLines={1}>
          {primary}
        </ThemedText>
        {!!secondary && (
          <ThemedText style={styles.rowSecondary} themeColor="textSecondary" numberOfLines={1}>
            {secondary}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
});

/** The "To" text field from the floating search card. Fully controlled. */
export function DestinationField({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (text: string) => void;
  autoFocus?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.field,
        { backgroundColor: theme.surfaceRaised, borderColor: theme.brand, boxShadow: `0 0 0 4px ${theme.tintBg}` },
      ]}>
      <SymbolView
        name={{ ios: 'mappin', android: 'location_on', web: 'location_on' }}
        size={16}
        tintColor={theme.brand}
      />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Where are you going?"
        placeholderTextColor={theme.textTertiary}
        accessibilityLabel="Destination search"
        returnKeyType="search"
        autoFocus={autoFocus}
        style={[styles.input, { color: theme.text }]}
      />
      {value.length > 0 && (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onChange('')} hitSlop={10}>
          <SymbolView
            name={{ ios: 'xmark', android: 'close', web: 'close' }}
            size={18}
            tintColor={theme.textSecondary}
          />
        </Pressable>
      )}
    </View>
  );
}

/** Live suggestions for `query`, debounced. Rendered in the bottom sheet. */
export function SuggestionList({
  query,
  sessionToken,
  locationBias,
  onSelect,
}: {
  query: string;
  sessionToken: string;
  locationBias?: LatLng;
  onSelect: (suggestion: PlaceSuggestion) => void;
}) {
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const { data, isFetching, isError } = useDestinationSearch(debounced, sessionToken, locationBias);

  if (debounced.trim().length <= 2) return null;

  return (
    <View style={styles.list}>
      {isFetching && <ActivityIndicator style={styles.status} />}
      {!isFetching && isError && (
        <ThemedText type="small" style={styles.status} accessibilityRole="alert">
          Couldn&apos;t search destinations right now.
        </ThemedText>
      )}
      {!isFetching && !isError && data?.length === 0 && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.status}>
          No matches
        </ThemedText>
      )}
      {!isFetching &&
        !isError &&
        data?.map((s, i) => (
          <PlaceRow
            key={s.placeId}
            highlighted={i === 0}
            primary={s.primaryText}
            secondary={s.secondaryText}
            onPress={() => onSelect(s)}
          />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
  },
  input: { flex: 1, minWidth: 0, height: 40, padding: 0, fontFamily: InterFont.semibold, fontSize: 16, outlineWidth: 0, outlineColor: 'transparent' },
  list: { gap: 4 },
  status: { paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 4, borderRadius: 14 },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rowIconBare: { backgroundColor: 'transparent' },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  rowPrimary: { fontFamily: InterFont.medium, fontSize: 15 },
  rowSecondary: { fontFamily: InterFont.regular, fontSize: 12 },
});
