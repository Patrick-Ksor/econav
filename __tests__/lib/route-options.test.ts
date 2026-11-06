import { RouteColors } from '@/constants/theme';
import { buildRouteOptions, explainRecommendation, formatArrival } from '@/lib/route-options';
import type { RoutePreferences } from '@/schemas/route-preferences';
import type { ComputedRouteOption, RouteComputationResult } from '@/schemas/routing';

const INPUTS = { mpg: 30, gasPricePerGallon: 3.29, depreciationPerMile: 0.18 };
const BALANCE: RoutePreferences = { priority: 'balance', timeValuePerHour: 18, includeTolls: true };

const option = (kind: ComputedRouteOption['kind'], miles: number, minutes: number): ComputedRouteOption => ({
  kind,
  distanceMiles: miles,
  durationMinutes: minutes,
  gallonsUsed: miles / 30,
  estimatedCost: 0,
  encodedPolyline: `poly-${kind}`,
});

const result = (optimized: ComputedRouteOption, standard: ComputedRouteOption): RouteComputationResult => ({
  origin: { label: 'Current location', location: { lat: 0, lng: 0 } },
  destination: { label: 'Target', location: { lat: 1, lng: 1 } },
  optimized,
  standard,
  savings: { dollars: 0, gallons: 0 },
  computedAt: '2026-11-05T12:00:00.000Z',
});

// Efficient is shorter but slower; Fastest is the reverse (the usual real-world shape).
const TWO_ROUTES = result(option('fuel_efficient', 24.6, 41), option('standard', 27.8, 29));

describe('buildRouteOptions', () => {
  test('returns Efficient then Fastest with their route colors', () => {
    const { options } = buildRouteOptions(TWO_ROUTES, INPUTS, BALANCE);
    expect(options.map((o) => o.label)).toEqual(['Efficient', 'Fastest']);
    expect(options[0].color).toBe(RouteColors.balanced);
    expect(options[1].color).toBe(RouteColors.fastest);
  });

  test('prices each route from distance, not from the raw routing cost', () => {
    const { options } = buildRouteOptions(TWO_ROUTES, INPUTS, BALANCE);
    expect(options[0].cost.total).toBeCloseTo(7.13, 2); // 24.6 mi
    expect(options[1].cost.total).toBeCloseTo(8.05, 2); // 27.8 mi, tolls unknown so $0
    expect(options[0].gallons).toBeCloseTo(24.6 / 30, 10);
  });

  test('the quickest route is the baseline', () => {
    const { baseline } = buildRouteOptions(TWO_ROUTES, INPUTS, BALANCE);
    expect(baseline.label).toBe('Fastest');
  });

  test('keeps the polyline for the map and external launch', () => {
    const { options } = buildRouteOptions(TWO_ROUTES, INPUTS, BALANCE);
    expect(options.map((o) => o.encodedPolyline)).toEqual(['poly-fuel_efficient', 'poly-standard']);
  });

  describe('recommendation follows the priority', () => {
    test('cost → Efficient', () => {
      const { recommendedIndex } = buildRouteOptions(TWO_ROUTES, INPUTS, { ...BALANCE, priority: 'cost' });
      expect(recommendedIndex).toBe(0);
    });

    test('fast → Fastest', () => {
      const { recommendedIndex } = buildRouteOptions(TWO_ROUTES, INPUTS, { ...BALANCE, priority: 'fast' });
      expect(recommendedIndex).toBe(1);
    });

    test('balance at $18/hr → Fastest (12 minutes is worth more than $0.93)', () => {
      expect(buildRouteOptions(TWO_ROUTES, INPUTS, BALANCE).recommendedIndex).toBe(1);
    });

    test('balance when time is free → Efficient', () => {
      const prefs = { ...BALANCE, timeValuePerHour: 0 };
      expect(buildRouteOptions(TWO_ROUTES, INPUTS, prefs).recommendedIndex).toBe(0);
    });
  });

  test('changing the vehicle depreciation re-prices without new directions', () => {
    const cheap = buildRouteOptions(TWO_ROUTES, { ...INPUTS, depreciationPerMile: 0 }, BALANCE);
    const costly = buildRouteOptions(TWO_ROUTES, { ...INPUTS, depreciationPerMile: 0.5 }, BALANCE);
    expect(costly.options[0].cost.total).toBeGreaterThan(cheap.options[0].cost.total);
  });

  describe('when Mapbox returns the same road twice', () => {
    const same = result(option('fuel_efficient', 10, 20), option('standard', 10.02, 20.2));

    test('shows one "Best route" instead of a fake choice', () => {
      const { options, recommendedIndex, baseline } = buildRouteOptions(same, INPUTS, BALANCE);
      expect(options).toHaveLength(1);
      expect(options[0].label).toBe('Best route');
      expect(recommendedIndex).toBe(0);
      expect(baseline).toBe(options[0]);
    });

    test('routes that differ by more than the tolerance stay separate', () => {
      const apart = result(option('fuel_efficient', 10, 20), option('standard', 10.5, 20));
      expect(buildRouteOptions(apart, INPUTS, BALANCE).options).toHaveLength(2);
    });
  });
});

describe('explainRecommendation', () => {
  test('balance: states both differences and the time-value trade', () => {
    const set = buildRouteOptions(TWO_ROUTES, INPUTS, BALANCE);
    const text = explainRecommendation(set, BALANCE)!;
    expect(text).toContain('costs an estimated $0.93 more than the efficient route');
    expect(text).toContain('takes 12 minutes less');
    expect(text).toContain('At your $18/hr time value');
  });

  test('cost: says the user asked for the lowest cost', () => {
    const prefs = { ...BALANCE, priority: 'cost' as const };
    const text = explainRecommendation(buildRouteOptions(TWO_ROUTES, INPUTS, prefs), prefs)!;
    expect(text).toContain('$0.93 less than the fastest route');
    expect(text).toContain('takes 12 minutes longer');
    expect(text).toContain('You asked for the lowest cost.');
  });

  test('fast: says the user asked for the fastest arrival', () => {
    const prefs = { ...BALANCE, priority: 'fast' as const };
    const text = explainRecommendation(buildRouteOptions(TWO_ROUTES, INPUTS, prefs), prefs)!;
    expect(text).toContain('You asked for the fastest arrival.');
  });

  test('uses the singular for a one-minute difference', () => {
    const close = result(option('fuel_efficient', 10, 21), option('standard', 10.5, 20));
    const prefs = { ...BALANCE, priority: 'fast' as const };
    const text = explainRecommendation(buildRouteOptions(close, INPUTS, prefs), prefs)!;
    expect(text).toContain('takes 1 minute less');
  });

  test('returns null when there is only one route to compare', () => {
    const same = result(option('fuel_efficient', 10, 20), option('standard', 10, 20));
    expect(explainRecommendation(buildRouteOptions(same, INPUTS, BALANCE), BALANCE)).toBeNull();
  });
});

describe('formatArrival', () => {
  const now = new Date(2026, 10, 5, 10, 42); // local time, so the assertion is timezone-proof

  test('adds the trip duration to the departure time', () => {
    expect(formatArrival(33, now)).toMatch(/^11:15\sAM$/);
  });

  test('zero minutes is the departure time itself', () => {
    expect(formatArrival(0, now)).toMatch(/^10:42\sAM$/);
  });

  test('rolls past noon', () => {
    expect(formatArrival(90, now)).toMatch(/^12:12\sPM$/);
  });
});
