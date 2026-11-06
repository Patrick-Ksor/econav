import { RoutePreferences, RoutePriority } from '@/schemas/route-preferences';

/** Raw facts about one candidate route. */
export interface RouteFacts {
  miles: number;
  minutes: number;
  tolls: number;
}

export interface CostInputs {
  mpg: number;
  gasPricePerGallon: number;
  /** $/mile of value the active vehicle loses. */
  depreciationPerMile: number;
}

export interface RouteCost {
  fuel: number;
  depreciation: number;
  /** Zero when the user has tolls turned off in preferences. */
  tolls: number;
  /** fuel + depreciation + tolls — what the trip actually costs. */
  total: number;
  /** total + time value. Used only to rank routes; never displayed as money spent. */
  score: number;
}

/**
 * Fuel = miles ÷ MPG × price/gal; depreciation = miles × $/mi; trip cost = fuel +
 * depreciation + tolls (tolls optional); time value = minutes ÷ 60 × $/hr (ranking only).
 */
export function computeRouteCost(
  route: RouteFacts,
  { mpg, gasPricePerGallon, depreciationPerMile }: CostInputs,
  prefs: RoutePreferences,
): RouteCost {
  const fuel = (route.miles / mpg) * gasPricePerGallon;
  const depreciation = route.miles * depreciationPerMile;
  const tolls = prefs.includeTolls ? route.tolls : 0;
  const total = fuel + depreciation + tolls;
  const score = total + (route.minutes / 60) * prefs.timeValuePerHour;
  return { fuel, depreciation, tolls, total, score };
}

/** Index of the recommended route for the user's priority. Ties go to the earlier route. */
export function pickRecommended(
  routes: { facts: RouteFacts; cost: RouteCost }[],
  priority: RoutePriority,
): number {
  const key = (r: (typeof routes)[number]) =>
    priority === 'cost' ? r.cost.total : priority === 'fast' ? r.facts.minutes : r.cost.score;
  return routes.reduce((best, r, i) => (key(r) < key(routes[best]) ? i : best), 0);
}

/** Dollars a route must save per extra `minutes` to be worth it, at the given $/hr. */
export function timeValueThreshold(minutes: number, timeValuePerHour: number): number {
  return (minutes / 60) * timeValuePerHour;
}

/** Savings vs. the baseline (fastest) route; positive means the chosen route is cheaper. */
export function savingsVsBaseline(baseline: RouteCost, chosen: RouteCost): number {
  return baseline.total - chosen.total;
}
