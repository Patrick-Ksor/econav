import { useAuth } from '@clerk/expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { TripHistoryEntry, TripHistoryEntrySchema, TripsSummary, TripsSummarySchema } from '@/schemas/routing';

async function fetchTrips(token: string | null): Promise<TripHistoryEntry[]> {
  const res = await fetch('/api/trips', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    throw new Error(`Failed to load trips: ${res.status}`);
  }
  return z.array(TripHistoryEntrySchema).parse(await res.json());
}

async function addTripRaw(token: string | null, trip: TripHistoryEntry): Promise<TripHistoryEntry> {
  const res = await fetch('/api/trips', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : undefined),
    },
    body: JSON.stringify(trip),
  });
  if (!res.ok) {
    throw new Error(`Failed to save trip: ${res.status}`);
  }
  return TripHistoryEntrySchema.parse(await res.json());
}

async function fetchTripsSummary(token: string | null): Promise<TripsSummary> {
  const res = await fetch('/api/trips/summary', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    throw new Error(`Failed to load trips summary: ${res.status}`);
  }
  return TripsSummarySchema.parse(await res.json());
}

async function deleteTripRaw(token: string | null, id: string): Promise<void> {
  const res = await fetch(`/api/trips/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    throw new Error(`Failed to delete trip: ${res.status}`);
  }
}

export function useTrips() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ['trips'],
    queryFn: async () => fetchTrips(await getToken()),
    enabled: !!isSignedIn,
  });
}

export function useTripsSummary() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ['trips-summary'],
    queryFn: async () => fetchTripsSummary(await getToken()),
    enabled: !!isSignedIn,
  });
}

export function useAddTrip() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (trip: TripHistoryEntry) => addTripRaw(await getToken(), trip),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['trips-summary'] });
    },
  });
}

export function useDeleteTrip() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => deleteTripRaw(await getToken(), id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['trips-summary'] });
    },
  });
}
