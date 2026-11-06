import { useQuery } from '@tanstack/react-query';

import { getPlaceDetailsRaw, searchPlacesRaw } from '@/services/mapbox';
import { LatLng } from '@/schemas/routing';

export function useDestinationSearch(input: string, sessionToken: string, locationBias?: LatLng) {
  return useQuery({
    queryKey: ['places-search', input, locationBias],
    queryFn: () => searchPlacesRaw(input, sessionToken, locationBias),
    enabled: input.trim().length > 2,
    staleTime: 30_000,
  });
}

export function usePlaceDetails(placeId: string | null, sessionToken: string) {
  return useQuery({
    queryKey: ['place-details', placeId],
    queryFn: () => getPlaceDetailsRaw(placeId!, sessionToken),
    enabled: !!placeId,
  });
}
