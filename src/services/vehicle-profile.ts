import { useAuth } from '@clerk/expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { VehicleProfile, VehicleProfileSchema } from '@/schemas/vehicle';

async function fetchVehicleProfile(token: string | null): Promise<VehicleProfile | null> {
  const res = await fetch('/api/vehicle-profile', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    throw new Error(`Failed to load vehicle profile: ${res.status}`);
  }
  const json = await res.json();
  return json ? VehicleProfileSchema.parse(json) : null;
}

async function saveVehicleProfile(
  token: string | null,
  profile: VehicleProfile,
): Promise<VehicleProfile> {
  const res = await fetch('/api/vehicle-profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : undefined),
    },
    body: JSON.stringify(profile),
  });
  if (!res.ok) {
    throw new Error(`Failed to save vehicle profile: ${res.status}`);
  }
  return VehicleProfileSchema.parse(await res.json());
}

export function useVehicleProfile() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ['vehicle-profile'],
    queryFn: async () => fetchVehicleProfile(await getToken()),
    enabled: !!isSignedIn,
  });
}

export function useSaveVehicleProfile() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profile: VehicleProfile) => saveVehicleProfile(await getToken(), profile),
    onSuccess: (data) => {
      queryClient.setQueryData(['vehicle-profile'], data);
    },
  });
}
