import { useAuth } from '@clerk/expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { GarageVehicle, GarageVehicleSchema } from '@/schemas/vehicle';

type NewVehicle = Omit<GarageVehicle, 'isActive'>;

const authHeaders = (token: string | null) => (token ? { Authorization: `Bearer ${token}` } : undefined);

async function fetchVehicles(token: string | null): Promise<GarageVehicle[]> {
  const res = await fetch('/api/vehicles', { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Failed to load vehicles: ${res.status}`);
  return z.array(GarageVehicleSchema).parse(await res.json());
}

async function addVehicleRaw(token: string | null, vehicle: NewVehicle): Promise<void> {
  const res = await fetch('/api/vehicles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(vehicle),
  });
  if (!res.ok) throw new Error(`Failed to add vehicle: ${res.status}`);
}

async function activateVehicleRaw(token: string | null, id: string): Promise<void> {
  const res = await fetch(`/api/vehicles/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to switch vehicle: ${res.status}`);
}

async function deleteVehicleRaw(token: string | null, id: string): Promise<void> {
  const res = await fetch(`/api/vehicles/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to remove vehicle: ${res.status}`);
}

/** Changing which vehicle is active (or its data) changes every trip's price, so refresh both caches. */
function useRefreshVehicles() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['garage-vehicles'] });
    queryClient.invalidateQueries({ queryKey: ['vehicle-profile'] });
  };
}

export function useGarageVehicles() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ['garage-vehicles'],
    queryFn: async () => fetchVehicles(await getToken()),
    enabled: !!isSignedIn,
  });
}

/** Adds a vehicle to the garage and makes it the active one. */
export function useAddVehicle() {
  const { getToken } = useAuth();
  const refresh = useRefreshVehicles();
  return useMutation({
    mutationFn: async (vehicle: NewVehicle) => addVehicleRaw(await getToken(), vehicle),
    onSuccess: refresh,
  });
}

export function useActivateVehicle() {
  const { getToken } = useAuth();
  const refresh = useRefreshVehicles();
  return useMutation({
    mutationFn: async (id: string) => activateVehicleRaw(await getToken(), id),
    onSuccess: refresh,
  });
}

export function useDeleteVehicle() {
  const { getToken } = useAuth();
  const refresh = useRefreshVehicles();
  return useMutation({
    mutationFn: async (id: string) => deleteVehicleRaw(await getToken(), id),
    onSuccess: refresh,
  });
}
