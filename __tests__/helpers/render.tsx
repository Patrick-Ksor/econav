import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { ReactElement, ReactNode } from 'react';

import { useAppearanceStore } from '@/stores/appearance-store';
import { useTripStore } from '@/stores/trip-store';

const clients: QueryClient[] = [];

// React Query keeps a garbage-collection timer per cached query and mutation, which would
// keep Jest alive after the run. Clearing the cache between tests cancels them.
afterEach(() => {
  clients.splice(0).forEach((c) => c.clear());
});

/**
 * Renders a screen inside a fresh React Query cache (no retries, so failures surface at once).
 * By default it waits for the screen's initial requests to finish, so a test starts from a
 * loaded screen. Pass `{ settle: false }` to test the loading state itself.
 */
export async function renderScreen(ui: ReactElement, { settle = true }: { settle?: boolean } = {}) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  clients.push(client);
  await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  if (settle) {
    // Mount effects start the queries (and the GPS lookup that gates some of them), so wait
    // until at least one query exists, then until nothing is in flight. React Query hands
    // results to React on a zero-delay timer, so flush that too, and repeat once so requests
    // that depend on an earlier result (e.g. gas price after location) are covered.
    const idle = () => {
      expect(client.getQueryCache().getAll().length).toBeGreaterThan(0);
      expect(client.isFetching() + client.isMutating()).toBe(0);
    };
    const flush = () => act(async () => new Promise<void>((resolve) => setTimeout(resolve, 0)));
    await flush();
    await waitFor(idle);
    await flush();
    await waitFor(idle);
    await flush();
  }
  return { client };
}

/** Renders a hook inside a fresh React Query cache, for testing services without a screen. */
export async function renderQueryHook<T>(hook: () => T) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const rendered = await renderHook(hook, { wrapper });
  return { client, ...rendered };
}

/** The mocked router, typed so tests can assert on calls. */
export const mockRouter = router as unknown as {
  push: jest.Mock;
  replace: jest.Mock;
  back: jest.Mock;
  canGoBack: jest.Mock;
};

export const mockSearchParams = useLocalSearchParams as unknown as jest.Mock;

/** Resets every piece of shared state a screen test could leak into the next one. */
const clerk = jest.requireMock('@clerk/expo') as { __auth: { signedIn: boolean; token: string | null } };

export function resetAppState() {
  clerk.__auth.signedIn = true;
  clerk.__auth.token = 'test-token';
  mockRouter.push.mockClear();
  mockRouter.replace.mockClear();
  mockRouter.back.mockClear();
  mockRouter.canGoBack.mockReturnValue(true);
  mockSearchParams.mockReturnValue({});
  useAppearanceStore.setState({ mode: 'light' });
  useTripStore.setState({ recentDestinations: [], lastRouteQuery: null, pendingTrip: null });
}
