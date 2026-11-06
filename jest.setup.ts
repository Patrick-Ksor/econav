// Global Jest setup. Everything here is a stand-in for something native or networked, so
// screens can render under Node. Per-test behavior (API responses, route params) is set in
// the tests themselves via the helpers in __tests__/helpers.

// AsyncStorage has no native module under Jest; use the package's in-memory mock. Stores
// (zustand persist) and the query persister import it at module load.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Safe-area insets need a native provider; the package ships a Jest mock.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// Always signed in as a fixed user; tests read `__signOut` / `__startSSOFlow` to assert on calls.
jest.mock('@clerk/expo', () => {
  const signOut = jest.fn();
  const startSSOFlow = jest.fn();
  // Tests flip these to simulate being signed out or having no session token.
  const auth = { signedIn: true, token: 'test-token' as string | null };
  return {
    __signOut: signOut,
    __startSSOFlow: startSSOFlow,
    __auth: auth,
    useSSO: () => ({ startSSOFlow }),
    useAuth: () => ({ isLoaded: true, isSignedIn: auth.signedIn, getToken: async () => auth.token, signOut }),
    useUser: () => ({
      user: {
        firstName: 'Maya',
        lastName: 'Chen',
        fullName: 'Maya Chen',
        primaryEmailAddress: { emailAddress: 'maya.chen@example.com' },
        createdAt: new Date(2026, 4, 3),
      },
    }),
  };
});

// Navigation is observed, not performed: tests assert on router.push / replace / back.
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useLocalSearchParams: jest.fn(() => ({})),
}));

// A granted GPS fix in Charlotte, NC.
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 35.15, longitude: -80.93 } })),
}));
