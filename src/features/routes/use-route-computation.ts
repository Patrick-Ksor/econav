import { useQuery } from '@tanstack/react-query';

import { computeFuelAwareRoutesRaw } from '@/services/mapbox';
import { LatLng, RouteComputationResult, RouteComputationResultSchema } from '@/schemas/routing';

interface RoutePoint {
  label: string;
  location: LatLng;
}

interface UseRouteComputationParams {
  origin: RoutePoint | null;
  destination: RoutePoint | null;
  mpg: number;
  pricePerGallon: number;
}

/**
 * The route comparison is modeled as a query, not a mutation: its inputs (origin,
 * destination, mpg, price) are deterministic, so the persisted query cache is what
 * makes "the last computed route" survive a tab switch or app restart, with no
 * separate copy of the result kept in client state.
 */
export function useRouteComputation({
  origin,
  destination,
  mpg,
  pricePerGallon,
}: UseRouteComputationParams) {
  return useQuery({
    queryKey: ['route-computation', origin?.location, destination?.location, mpg, pricePerGallon],
    queryFn: async (): Promise<RouteComputationResult> => {
      const { optimized, standard } = await computeFuelAwareRoutesRaw(
        origin!.location,
        destination!.location,
        mpg,
        pricePerGallon,
      );
      return RouteComputationResultSchema.parse({
        origin: { label: origin!.label, location: origin!.location },
        destination: { label: destination!.label, location: destination!.location },
        optimized,
        standard,
        savings: {
          dollars: standard.estimatedCost - optimized.estimatedCost,
          gallons: standard.gallonsUsed - optimized.gallonsUsed,
        },
        computedAt: new Date().toISOString(),
      });
    },
    enabled: !!origin && !!destination,
    retry: 1,
  });
}
