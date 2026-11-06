import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { LatLng, RecentDestination } from '@/schemas/routing';

const MAX_RECENT_DESTINATIONS = 8;

interface RoutePoint {
  label: string;
  location: LatLng;
}

interface LastRouteQuery {
  origin: RoutePoint;
  destination: RoutePoint;
}

/**
 * A trip the user started in their maps app but hasn't confirmed yet. Persisted so it
 * survives leaving EcoNav (and, on web, the page navigating away) — savings only count
 * once the user confirms it on the summary screen.
 */
export interface PendingTrip {
  originLabel: string;
  destinationLabel: string;
  routeLabel: string;
  routeColor: string;
  distanceMiles: number;
  durationMinutes: number;
  /** Estimated trip cost (fuel + depreciation + tolls) of the route taken. */
  cost: number;
  /** Same figure for the baseline (fastest) route. */
  baselineCost: number;
  baselineMinutes: number;
  savingsDollars: number;
  savingsGallons: number;
  startedAt: string;
}

interface TripStore {
  recentDestinations: RecentDestination[];
  lastRouteQuery: LastRouteQuery | null;
  pendingTrip: PendingTrip | null;
  addRecentDestination: (destination: RecentDestination) => void;
  clearRecentDestinations: () => void;
  setLastRouteQuery: (query: LastRouteQuery) => void;
  setPendingTrip: (trip: PendingTrip) => void;
  clearPendingTrip: () => void;
}

export const useTripStore = create<TripStore>()(
  persist(
    (set) => ({
      recentDestinations: [],
      lastRouteQuery: null,
      pendingTrip: null,
      setPendingTrip: (trip) => set({ pendingTrip: trip }),
      clearPendingTrip: () => set({ pendingTrip: null }),
      addRecentDestination: (destination) =>
        set((state) => ({
          recentDestinations: [
            destination,
            ...state.recentDestinations.filter((d) => d.placeId !== destination.placeId),
          ].slice(0, MAX_RECENT_DESTINATIONS),
        })),
      clearRecentDestinations: () => set({ recentDestinations: [] }),
      setLastRouteQuery: (query) => set({ lastRouteQuery: query }),
    }),
    {
      name: 'econav.trips.v1',
      storage: createJSONStorage(() => AsyncStorage),
      // The last calculated route is a live session artifact, not history worth
      // keeping — only recent destinations and the unconfirmed pending trip persist
      // across restarts. `merge` also forces the route query back to null on hydrate so
      // a value saved before this change (or seeded manually) can't leak back in.
      partialize: (state) => ({
        recentDestinations: state.recentDestinations,
        pendingTrip: state.pendingTrip,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<TripStore>),
        lastRouteQuery: null,
      }),
    },
  ),
);
