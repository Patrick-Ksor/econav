import {
  computeRouteCost,
  pickRecommended,
  savingsVsBaseline,
  timeValueThreshold,
  type CostInputs,
  type RouteFacts,
} from '@/lib/cost-model';
import type { RoutePreferences } from '@/schemas/route-preferences';

// The handoff's sample trip: 2021 RAV4, 30 MPG, $3.29/gal, $0.18/mi, $18/hr.
const INPUTS: CostInputs = { mpg: 30, gasPricePerGallon: 3.29, depreciationPerMile: 0.18 };
const PREFS: RoutePreferences = { priority: 'balance', timeValuePerHour: 18, includeTolls: true };

const CHEAPEST: RouteFacts = { miles: 24.6, minutes: 41, tolls: 0 };
const BALANCED: RouteFacts = { miles: 25.9, minutes: 33, tolls: 0 };
const FASTEST: RouteFacts = { miles: 27.8, minutes: 29, tolls: 3.5 };

describe('computeRouteCost', () => {
  // Expected figures come straight from the handoff's sample table.
  test.each([
    ['Balanced', BALANCED, { fuel: 2.84, depreciation: 4.66, total: 7.5, score: 17.4 }],
    ['Cheapest', CHEAPEST, { fuel: 2.7, depreciation: 4.43, total: 7.13, score: 19.43 }],
    ['Fastest', FASTEST, { fuel: 3.05, depreciation: 5.0, total: 11.55, score: 20.25 }],
  ])('matches the handoff table for %s', (_name, facts, expected) => {
    const cost = computeRouteCost(facts, INPUTS, PREFS);
    expect(cost.fuel).toBeCloseTo(expected.fuel, 2);
    expect(cost.depreciation).toBeCloseTo(expected.depreciation, 2);
    expect(cost.total).toBeCloseTo(expected.total, 2);
    expect(cost.score).toBeCloseTo(expected.score, 2);
  });

  test('fuel is miles ÷ MPG × price per gallon', () => {
    const cost = computeRouteCost({ miles: 60, minutes: 60, tolls: 0 }, { ...INPUTS, mpg: 30, gasPricePerGallon: 4 }, PREFS);
    expect(cost.fuel).toBeCloseTo(8, 10); // 2 gallons × $4
  });

  test('depreciation uses the vehicle, not the preferences', () => {
    const cheap = computeRouteCost(BALANCED, { ...INPUTS, depreciationPerMile: 0.1 }, PREFS);
    const pricey = computeRouteCost(BALANCED, { ...INPUTS, depreciationPerMile: 0.3 }, PREFS);
    expect(cheap.depreciation).toBeCloseTo(2.59, 2);
    expect(pricey.depreciation).toBeCloseTo(7.77, 2);
  });

  test('tolls count toward the total only when included', () => {
    const included = computeRouteCost(FASTEST, INPUTS, { ...PREFS, includeTolls: true });
    const excluded = computeRouteCost(FASTEST, INPUTS, { ...PREFS, includeTolls: false });
    expect(included.tolls).toBe(3.5);
    expect(excluded.tolls).toBe(0);
    expect(included.total - excluded.total).toBeCloseTo(3.5, 10);
  });

  test('time value affects the score but never the trip cost', () => {
    const none = computeRouteCost(BALANCED, INPUTS, { ...PREFS, timeValuePerHour: 0 });
    const lots = computeRouteCost(BALANCED, INPUTS, { ...PREFS, timeValuePerHour: 100 });
    expect(none.total).toBeCloseTo(lots.total, 10);
    expect(none.score).toBeCloseTo(none.total, 10);
    expect(lots.score).toBeCloseTo(lots.total + (33 / 60) * 100, 10);
  });

  test('a zero-mile route costs nothing but still has a time score', () => {
    const cost = computeRouteCost({ miles: 0, minutes: 30, tolls: 0 }, INPUTS, PREFS);
    expect(cost.total).toBe(0);
    expect(cost.score).toBeCloseTo(9, 10);
  });
});

describe('pickRecommended', () => {
  const routes = [CHEAPEST, BALANCED, FASTEST].map((facts) => ({
    facts,
    cost: computeRouteCost(facts, INPUTS, PREFS),
  }));

  test('"cost" picks the lowest trip cost', () => {
    expect(pickRecommended(routes, 'cost')).toBe(0); // Cheapest, $7.13
  });

  test('"balance" picks the lowest score', () => {
    expect(pickRecommended(routes, 'balance')).toBe(1); // Balanced, 17.40
  });

  test('"fast" picks the fewest minutes', () => {
    expect(pickRecommended(routes, 'fast')).toBe(2); // Fastest, 29 min
  });

  test('ties go to the earlier route', () => {
    const same = { facts: BALANCED, cost: computeRouteCost(BALANCED, INPUTS, PREFS) };
    expect(pickRecommended([same, { ...same }], 'cost')).toBe(0);
    expect(pickRecommended([same, { ...same }], 'balance')).toBe(0);
    expect(pickRecommended([same, { ...same }], 'fast')).toBe(0);
  });

  test('a single route is always the pick', () => {
    expect(pickRecommended([routes[2]], 'cost')).toBe(0);
  });

  test('a higher time value moves "balance" toward the faster route', () => {
    const at = (rate: number) => {
      const prefs = { ...PREFS, timeValuePerHour: rate };
      const priced = [CHEAPEST, FASTEST].map((facts) => ({ facts, cost: computeRouteCost(facts, INPUTS, prefs) }));
      return pickRecommended(priced, 'balance');
    };
    expect(at(0)).toBe(0); // free time: take the cheap route
    expect(at(100)).toBe(1); // time is money: take the fast route
  });
});

describe('timeValueThreshold', () => {
  test('4 extra minutes at $18/hr is worth $1.20', () => {
    expect(timeValueThreshold(4, 18)).toBeCloseTo(1.2, 10);
  });

  test('is zero when time is free', () => {
    expect(timeValueThreshold(30, 0)).toBe(0);
  });
});

describe('savingsVsBaseline', () => {
  const base = computeRouteCost(FASTEST, INPUTS, PREFS);
  const chosen = computeRouteCost(BALANCED, INPUTS, PREFS);

  test('is the baseline cost minus the chosen cost', () => {
    expect(savingsVsBaseline(base, chosen)).toBeCloseTo(4.05, 2);
  });

  test('is negative when the chosen route costs more', () => {
    expect(savingsVsBaseline(chosen, base)).toBeCloseTo(-4.05, 2);
  });

  test('is zero when the baseline is the chosen route', () => {
    expect(savingsVsBaseline(base, base)).toBe(0);
  });
});
