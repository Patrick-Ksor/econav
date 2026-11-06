import { SymbolView } from 'expo-symbols';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, View, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';

import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const TAB_BAR_HEIGHT = 72;

export default function AppTabs() {
  return (
    <Tabs>
      {/* The tab bar below is `position: absolute` with `bottom: 0`, so scrollable content
          needs matching bottom clearance. */}
      <TabSlot style={{ height: '100%', paddingBottom: TAB_BAR_HEIGHT }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/home" asChild>
            <TabButton icon="home">Home</TabButton>
          </TabTrigger>
          <TabTrigger name="garage" href="/garage" asChild>
            <TabButton icon="directions_car">Garage</TabButton>
          </TabTrigger>
          <TabTrigger name="savings" href="/savings" asChild>
            <TabButton icon="bar_chart">Savings</TabButton>
          </TabTrigger>
          <TabTrigger name="profile" href="/profile" asChild>
            <TabButton icon="person">Profile</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({
  children,
  icon,
  isFocused,
  ...props
}: TabTriggerSlotProps & { icon: 'home' | 'directions_car' | 'bar_chart' | 'person' }) {
  const theme = useTheme();
  const color = isFocused ? theme.brand : theme.textSecondary;
  return (
    <Pressable {...props} style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
      <View style={[styles.pill, isFocused && { backgroundColor: theme.tintBg }]}>
        <SymbolView name={{ web: icon }} size={22} tintColor={color} />
      </View>
      <ThemedText
        numberOfLines={1}
        style={[styles.label, isFocused && styles.labelFocused, { color }]}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const theme = useTheme();
  return (
    <View
      {...props}
      style={[styles.bar, { backgroundColor: theme.tabBar, borderTopColor: theme.border }]}>
      <View style={styles.inner}>{props.children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: TAB_BAR_HEIGHT,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  inner: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  pressed: { opacity: 0.7 },
  pill: {
    width: 52,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 11, lineHeight: 14, letterSpacing: 0.11 },
  labelFocused: { fontFamily: 'Inter_700Bold' },
});
