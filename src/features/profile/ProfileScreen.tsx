import { useAuth, useUser } from '@clerk/expo';
import { router } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { InterFont, MaxContentWidth } from '@/constants/theme';
import { useBottomTabPadding } from '@/hooks/use-bottom-tab-padding';
import { useTheme } from '@/hooks/use-theme';
import { formatUsd } from '@/lib/format';
import { RoutePriority } from '@/schemas/route-preferences';
import { useRoutePreferences } from '@/services/route-preferences';
import { useVehicleProfile } from '@/services/vehicle-profile';
import { AppearanceMode, useAppearanceStore } from '@/stores/appearance-store';

const PRIORITY_LABEL: Record<RoutePriority, string> = {
  cost: 'Lowest cost',
  balance: 'Balanced',
  fast: 'Fastest',
};

const APPEARANCE: { value: AppearanceMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const MEMBER_SINCE = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

export function ProfileScreen() {
  const theme = useTheme();
  const bottomPadding = useBottomTabPadding();
  const { user } = useUser();
  const { signOut } = useAuth();
  const { data: prefs } = useRoutePreferences();
  const { data: vehicle } = useVehicleProfile();
  const appearance = useAppearanceStore((s) => s.mode);
  const setAppearance = useAppearanceStore((s) => s.setMode);

  const name = user?.fullName ?? 'Your account';
  const email = user?.primaryEmailAddress?.emailAddress;
  const initials =
    [user?.firstName, user?.lastName]
      .filter(Boolean)
      .map((n) => n![0])
      .join('')
      .toUpperCase() || 'EN';
  const card = { backgroundColor: theme.surfaceRaised, borderColor: theme.border };

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 24 }]}>
          <ThemedText type="title">Profile</ThemedText>

          <View style={[styles.account, card]}>
            <View style={[styles.avatar, { backgroundColor: theme.tintBg }]}>
              <ThemedText style={[styles.avatarText, { color: theme.brand }]}>{initials}</ThemedText>
            </View>
            <View style={styles.accountText}>
              <ThemedText style={styles.accountName} numberOfLines={1}>
                {name}
              </ThemedText>
              {email && (
                <ThemedText style={styles.accountMeta} themeColor="textSecondary" numberOfLines={1}>
                  {email}
                </ThemedText>
              )}
              {user?.createdAt && (
                <ThemedText style={styles.accountMeta} themeColor="textSecondary">
                  Member since {MEMBER_SINCE.format(user.createdAt)}
                </ThemedText>
              )}
            </View>
          </View>

          <Group title="Driving">
            <Row
              icon={{ ios: 'car.fill', android: 'directions_car', web: 'directions_car' }}
              title="Default vehicle"
              value={vehicle ? `${vehicle.year} ${vehicle.makeModel}` : 'Not set'}
              onPress={() => router.push('/garage')}
            />
            <Row
              icon={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }}
              title="Route optimization"
              value={prefs ? `${PRIORITY_LABEL[prefs.priority]} · ${formatUsd(prefs.timeValuePerHour).replace('.00', '')}/hr` : undefined}
              onPress={() => router.push('/route-preferences')}
            />
            <Row
              icon={{ ios: 'fuelpump.fill', android: 'local_gas_station', web: 'local_gas_station' }}
              title="Fuel price"
              value={vehicle?.gasPriceOverride != null ? `Custom · ${formatUsd(vehicle.gasPriceOverride)}` : 'Local average'}
              onPress={() => router.push('/route-preferences')}
              last
            />
          </Group>

          <Group title="Appearance">
            <View style={styles.appearanceRow}>
              <View style={[styles.segmented, { backgroundColor: theme.backgroundElement }]}>
                {APPEARANCE.map((a) => {
                  const on = a.value === appearance;
                  return (
                    <Pressable
                      key={a.value}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      onPress={() => setAppearance(a.value)}
                      style={[styles.segment, on && { backgroundColor: theme.surfaceRaised, boxShadow: '0 1px 3px rgba(15,23,42,0.12)' }]}>
                      <ThemedText style={[styles.segmentLabel, { color: on ? theme.brand : theme.textSecondary }]}>
                        {a.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Group>

          {Platform.OS !== 'web' && (
            <Group title="Privacy">
              <Row
                icon={{ ios: 'location.fill', android: 'location_on', web: 'location_on' }}
                title="Location access"
                value="Open settings"
                onPress={() => Linking.openSettings()}
                last
              />
            </Group>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={() => signOut()}
            style={[styles.logout, card]}>
            <SymbolView
              name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }}
              size={20}
              tintColor={theme.text}
            />
            <ThemedText style={styles.logoutLabel}>Log out</ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.group}>
      <ThemedText type="overline" themeColor="textSecondary" style={styles.groupTitle}>
        {title}
      </ThemedText>
      <View style={[styles.groupCard, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
        {children}
      </View>
    </View>
  );
}

function Row({
  icon,
  title,
  value,
  onPress,
  last,
}: {
  icon: SymbolViewProps['name'];
  title: string;
  value?: string;
  onPress: () => void;
  last?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
      <View style={[styles.rowIcon, { backgroundColor: theme.tintBg }]}>
        <SymbolView name={icon} size={20} tintColor={theme.brand} />
      </View>
      <ThemedText style={styles.rowTitle}>{title}</ThemedText>
      {value && (
        <ThemedText style={styles.rowValue} themeColor="textSecondary" numberOfLines={1}>
          {value}
        </ThemedText>
      )}
      <SymbolView
        name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
        size={16}
        tintColor={theme.textTertiary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, gap: 16, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },

  account: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderRadius: 20, borderWidth: 1 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: InterFont.extrabold, fontSize: 20 },
  accountText: { flex: 1, minWidth: 0, gap: 2 },
  accountName: { fontFamily: InterFont.bold, fontSize: 18, letterSpacing: -0.01 * 18 },
  accountMeta: { fontFamily: InterFont.regular, fontSize: 13 },

  group: { gap: 8 },
  groupTitle: { paddingHorizontal: 4 },
  groupCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10, paddingHorizontal: 14 },
  rowIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { flex: 1, fontFamily: InterFont.semibold, fontSize: 15 },
  rowValue: { flexShrink: 1, maxWidth: '50%', fontFamily: InterFont.regular, fontSize: 14, textAlign: 'right' },

  appearanceRow: { padding: 12 },
  segmented: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 12 },
  segment: { flex: 1, height: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segmentLabel: { fontFamily: InterFont.bold, fontSize: 13 },

  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 56, borderRadius: 20, borderWidth: 1, marginTop: 8 },
  logoutLabel: { fontFamily: InterFont.bold, fontSize: 16 },
});
