import { z } from 'zod';

/** What the recommendation optimizes for. `balance` weighs cost against time via `timeValuePerHour`. */
export const RoutePrioritySchema = z.enum(['cost', 'balance', 'fast']);
export type RoutePriority = z.infer<typeof RoutePrioritySchema>;

export const RoutePreferencesSchema = z.object({
  priority: RoutePrioritySchema,
  /** $/hr used only to rank routes in balance mode; never shown as money spent. */
  timeValuePerHour: z.number().min(0).max(100),
  includeTolls: z.boolean(),
});
export type RoutePreferences = z.infer<typeof RoutePreferencesSchema>;

// Defaults from the design handoff's sample trip.
export const DEFAULT_ROUTE_PREFERENCES: RoutePreferences = {
  priority: 'balance',
  timeValuePerHour: 18,
  includeTolls: true,
};
