import { RouteColors } from '@/constants/theme';
import { RouteComputationResult } from '@/schemas/routing';
import { RoutePreferences } from '@/schemas/route-preferences';

import { computeRouteCost, CostInputs, pickRecommended, RouteCost, RouteFacts } from './cost-model';
import { formatUsd } from './format';

export type RouteOptionId = 'efficient' | 'fastest';

export interface RouteOption {
  id: RouteOptionId;
  label: string;
  color: string;
  facts: RouteFacts;
  cost: RouteCost;
  gallons: number;
  encodedPolyline?: string;
}

export interface RouteOptionSet {
  options: RouteOption[];
  recommendedIndex: number;
  /** The quickest option — the yardstick that savings are measured against. */
  baseline: RouteOption;
}

// Two routes this close are the same road to a driver; show one instead of a fake choice.
const SAME_ROUTE_MILES = 0.05;
const SAME_ROUTE_MINUTES = 0.5;

/**
 * Turns the routing result (efficient vs. standard) into priced options. Costs are
 * recomputed here from the user's current preferences, so changing a setting reprices
 * and re-ranks without refetching directions.
 */
export function buildRouteOptions(
  result: RouteComputationResult,
  inputs: CostInputs,
  prefs: RoutePreferences,
): RouteOptionSet {
  const make = (
    id: RouteOptionId,
    label: string,
    color: string,
    raw: RouteComputationResult['optimized'],
  ): RouteOption => {
    const facts = { miles: raw.distanceMiles, minutes: raw.durationMinutes, tolls: 0 };
    return {
      id,
      label,
      color,
      facts,
      cost: computeRouteCost(facts, inputs, prefs),
      gallons: facts.miles / inputs.mpg,
      encodedPolyline: raw.encodedPolyline,
    };
  };

  const efficient = make('efficient', 'Efficient', RouteColors.balanced, result.optimized);
  const fastest = make('fastest', 'Fastest', RouteColors.fastest, result.standard);

  const identical =
    Math.abs(efficient.facts.miles - fastest.facts.miles) < SAME_ROUTE_MILES &&
    Math.abs(efficient.facts.minutes - fastest.facts.minutes) < SAME_ROUTE_MINUTES;
  const options = identical ? [{ ...fastest, label: 'Best route', color: RouteColors.balanced }] : [efficient, fastest];

  const baseline = options.reduce((q, o) => (o.facts.minutes < q.facts.minutes ? o : q), options[0]);
  const recommendedIndex = pickRecommended(options, prefs.priority);
  return { options, recommendedIndex, baseline };
}

/** "Why this route" copy, or null when there's nothing to compare against. */
export function explainRecommendation(set: RouteOptionSet, prefs: RoutePreferences): string | null {
  if (set.options.length < 2) return null;
  const rec = set.options[set.recommendedIndex];
  const other = set.options[1 - set.recommendedIndex];

  const costDiff = other.cost.total - rec.cost.total;
  const minDiff = Math.round(rec.facts.minutes - other.facts.minutes);
  const otherName = other.label.toLowerCase();

  const costPart =
    Math.abs(costDiff) < 0.005
      ? `costs about the same as the ${otherName} route`
      : `costs an estimated ${formatUsd(Math.abs(costDiff))} ${costDiff > 0 ? 'less' : 'more'} than the ${otherName} route`;
  const timePart =
    minDiff === 0
      ? 'takes the same time'
      : `takes ${Math.abs(minDiff)} minute${Math.abs(minDiff) === 1 ? '' : 's'} ${minDiff > 0 ? 'longer' : 'less'}`;

  const tail =
    prefs.priority === 'balance'
      ? ` At your ${formatUsd(prefs.timeValuePerHour).replace('.00', '')}/hr time value, that trade is worth it.`
      : prefs.priority === 'cost'
        ? ' You asked for the lowest cost.'
        : ' You asked for the fastest arrival.';
  return `it ${costPart} and ${timePart}.${tail}`;
}

const ARRIVAL_FORMAT = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

export function formatArrival(minutesFromNow: number, now: Date = new Date()): string {
  return ARRIVAL_FORMAT.format(new Date(now.getTime() + minutesFromNow * 60_000));
}
