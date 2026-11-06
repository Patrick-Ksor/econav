import { z } from 'zod';

export const LatLngSchema = z.object({ lat: z.number(), lng: z.number() });
export type LatLng = z.infer<typeof LatLngSchema>;

export const PlaceSuggestionSchema = z.object({
  placeId: z.string(),
  primaryText: z.string(),
  secondaryText: z.string(),
});
export type PlaceSuggestion = z.infer<typeof PlaceSuggestionSchema>;

export const PlaceDetailsSchema = z.object({
  placeId: z.string(),
  location: LatLngSchema,
  formattedAddress: z.string(),
});
export type PlaceDetails = z.infer<typeof PlaceDetailsSchema>;

export const RecentDestinationSchema = z.object({
  placeId: z.string(),
  label: z.string(),
  location: LatLngSchema,
  lastUsedAt: z.string(),
});
export type RecentDestination = z.infer<typeof RecentDestinationSchema>;

export const ComputedRouteOptionSchema = z.object({
  kind: z.enum(['fuel_efficient', 'standard']),
  distanceMiles: z.number(),
  durationMinutes: z.number(),
  // Estimated travel time under typical/free-flow conditions, from Mapbox's
  // driving-traffic profile. `durationMinutes` minus this is the live traffic delay.
  // Optional since it's only meaningful for driving-traffic-profile results.
  durationTypicalMinutes: z.number().optional(),
  gallonsUsed: z.number(),
  estimatedCost: z.number(),
  encodedPolyline: z.string().optional(),
});
export type ComputedRouteOption = z.infer<typeof ComputedRouteOptionSchema>;

export const RouteComputationResultSchema = z.object({
  origin: z.object({ label: z.string(), location: LatLngSchema }),
  destination: z.object({ label: z.string(), location: LatLngSchema }),
  optimized: ComputedRouteOptionSchema,
  standard: ComputedRouteOptionSchema,
  savings: z.object({ dollars: z.number(), gallons: z.number() }),
  computedAt: z.string(),
});
export type RouteComputationResult = z.infer<typeof RouteComputationResultSchema>;

export const TripHistoryEntrySchema = z.object({
  id: z.string(),
  destinationLabel: z.string(),
  distanceMiles: z.number(),
  estimatedCost: z.number(),
  createdAt: z.string(),
  // Optional — only present on trips saved after savings tracking shipped, so
  // older rows (and any aggregate using them) must handle these being absent
  // rather than treating them as zero.
  savingsDollars: z.number().nullable().optional(),
  savingsGallons: z.number().nullable().optional(),
});
export type TripHistoryEntry = z.infer<typeof TripHistoryEntrySchema>;

export const TripsSummarySchema = z.object({
  tripCount: z.number(),
  totalSavingsDollars: z.number(),
  totalSavingsGallons: z.number(),
  monthSavingsDollars: z.number(),
});
export type TripsSummary = z.infer<typeof TripsSummarySchema>;
