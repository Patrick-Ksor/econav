import { useAuth } from '@clerk/expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  DEFAULT_ROUTE_PREFERENCES,
  RoutePreferences,
  RoutePreferencesSchema,
} from '@/schemas/route-preferences';

async function fetchRoutePreferences(token: string | null): Promise<RoutePreferences> {
  const res = await fetch('/api/route-preferences', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    throw new Error(`Failed to load route preferences: ${res.status}`);
  }
  return RoutePreferencesSchema.parse(await res.json());
}

async function saveRoutePreferences(
  token: string | null,
  prefs: RoutePreferences,
): Promise<RoutePreferences> {
  const res = await fetch('/api/route-preferences', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : undefined),
    },
    body: JSON.stringify(prefs),
  });
  if (!res.ok) {
    throw new Error(`Failed to save route preferences: ${res.status}`);
  }
  return RoutePreferencesSchema.parse(await res.json());
}

/**
 * Resolves to the saved preferences, or the handoff defaults until the user saves any.
 *
 * `data` is always defined: while loading it is the defaults (a placeholder), and if the
 * request fails it stays the defaults, so screens that only *read* preferences (route
 * comparison, Home, Profile) keep working instead of waiting forever on a secondary
 * request. `isPlaceholderData` is true in both cases; use `isError` to tell them apart.
 */
export function useRoutePreferences() {
  const { getToken, isSignedIn } = useAuth();
  const query = useQuery({
    queryKey: ['route-preferences'],
    queryFn: async () => fetchRoutePreferences(await getToken()),
    enabled: !!isSignedIn,
    placeholderData: DEFAULT_ROUTE_PREFERENCES,
  });
  return {
    ...query,
    data: query.data ?? DEFAULT_ROUTE_PREFERENCES,
    isPlaceholderData: query.isPlaceholderData || query.data === undefined,
  };
}

export function useSaveRoutePreferences() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: RoutePreferences) => saveRoutePreferences(await getToken(), prefs),
    onSuccess: (data) => {
      queryClient.setQueryData(['route-preferences'], data);
    },
  });
}
