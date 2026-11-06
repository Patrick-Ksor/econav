import { Stack } from 'expo-router';

// Tabs are Home · Garage · Savings · Profile. Search → compare → confirm is a focused flow
// pushed over the tabs (no tab bar), per the design handoff.
export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="routes" />
      <Stack.Screen name="route-compare" />
      <Stack.Screen name="trip-summary" />
      <Stack.Screen name="trip-history" />
      <Stack.Screen name="trip-detail" />
      <Stack.Screen name="route-preferences" />
      <Stack.Screen name="add-vehicle" />
    </Stack>
  );
}
