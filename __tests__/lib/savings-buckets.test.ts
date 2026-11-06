import {
  bucketTrips,
  periodRangeLabel,
  previousMonthTotal,
  tripsInPeriod,
} from '@/lib/savings-buckets';
import type { TripHistoryEntry } from '@/schemas/routing';

// Thursday, Nov 5 2026, noon local time.
const NOW = new Date(2026, 10, 5, 12, 0);

let nextId = 0;
const trip = (when: Date, savingsDollars: number | null = 1): TripHistoryEntry => ({
  id: `t${nextId++}`,
  destinationLabel: 'Somewhere',
  distanceMiles: 5,
  estimatedCost: 2,
  createdAt: when.toISOString(),
  savingsDollars,
  savingsGallons: null,
});

describe('tripsInPeriod', () => {
  const today = trip(new Date(2026, 10, 5, 9));
  const sixDaysAgo = trip(new Date(2026, 9, 30, 0, 30)); // inside the 7-day window
  const sevenDaysAgo = trip(new Date(2026, 9, 29, 23)); // just outside it
  const earlierThisMonth = trip(new Date(2026, 10, 1));
  const lastMonth = trip(new Date(2026, 9, 15));
  const lastYear = trip(new Date(2025, 11, 31));
  const all = [today, sixDaysAgo, sevenDaysAgo, earlierThisMonth, lastMonth, lastYear];

  test('week keeps the last 7 calendar days including today', () => {
    expect(tripsInPeriod(all, 'week', NOW)).toEqual([today, sixDaysAgo, earlierThisMonth]);
  });

  test('month keeps only the current calendar month', () => {
    expect(tripsInPeriod(all, 'month', NOW)).toEqual([today, earlierThisMonth]);
  });

  test('year keeps only the current calendar year', () => {
    expect(tripsInPeriod(all, 'year', NOW)).not.toContain(lastYear);
    expect(tripsInPeriod(all, 'year', NOW)).toHaveLength(5);
  });

  test('all keeps everything', () => {
    expect(tripsInPeriod(all, 'all', NOW)).toEqual(all);
  });
});

describe('bucketTrips: week', () => {
  const bars = bucketTrips(
    [trip(new Date(2026, 10, 5, 8), 2), trip(new Date(2026, 10, 5, 17), 0.5), trip(new Date(2026, 10, 3), -1)],
    'week',
    NOW,
  );

  test('has seven daily bars ending today, labeled by weekday', () => {
    expect(bars.map((b) => b.label)).toEqual(['F', 'S', 'S', 'M', 'T', 'W', 'T']);
  });

  test('sums every trip on a day, and keeps losses negative', () => {
    expect(bars[6].value).toBeCloseTo(2.5, 10); // today
    expect(bars[4].value).toBe(-1); // Tuesday Nov 3
    expect(bars[5].value).toBe(0); // Wednesday: no trips
  });
});

describe('bucketTrips: month', () => {
  test('early in the month there is a single first-week bar', () => {
    const bars = bucketTrips([trip(new Date(2026, 10, 2), 3)], 'month', NOW);
    expect(bars).toEqual([{ label: '1–7', value: 3 }]);
  });

  test('later in the month there is a bar per elapsed week', () => {
    const late = new Date(2026, 10, 20);
    const bars = bucketTrips(
      [trip(new Date(2026, 10, 2), 1), trip(new Date(2026, 10, 9), 2), trip(new Date(2026, 10, 20), 4)],
      'month',
      late,
    );
    expect(bars.map((b) => b.label)).toEqual(['1–7', '8–14', '15–21']);
    expect(bars.map((b) => b.value)).toEqual([1, 2, 4]);
  });

  test('ignores trips from other months', () => {
    const bars = bucketTrips([trip(new Date(2026, 9, 2), 9)], 'month', NOW);
    expect(bars[0].value).toBe(0);
  });

  test('the last week label stops at the end of a short month', () => {
    const feb = new Date(2027, 1, 27); // Feb 2027 has 28 days
    const labels = bucketTrips([], 'month', feb).map((b) => b.label);
    expect(labels).toEqual(['1–7', '8–14', '15–21', '22–28']);
  });
});

describe('bucketTrips: year', () => {
  test('has one bar per month from January to the current month', () => {
    const bars = bucketTrips([], 'year', NOW);
    expect(bars).toHaveLength(11);
    expect(bars[0].label).toBe('Jan');
    expect(bars[10].label).toBe('Nov');
  });

  test('sums trips into their month', () => {
    const bars = bucketTrips(
      [trip(new Date(2026, 8, 3), 5), trip(new Date(2026, 8, 20), 2.5), trip(new Date(2026, 9, 1), 1)],
      'year',
      NOW,
    );
    expect(bars[8].value).toBe(7.5); // Sep
    expect(bars[9].value).toBe(1); // Oct
  });
});

describe('bucketTrips: all', () => {
  test('runs from the oldest loaded trip to this month', () => {
    const bars = bucketTrips([trip(new Date(2026, 8, 3), 4)], 'all', NOW);
    expect(bars.map((b) => b.label)).toEqual(['Sep', 'Oct', 'Nov']);
    expect(bars[0].value).toBe(4);
  });

  test('with no trips there is just the current month', () => {
    expect(bucketTrips([], 'all', NOW)).toEqual([{ label: 'Nov', value: 0 }]);
  });

  test('caps the chart at the latest 12 months', () => {
    const bars = bucketTrips([trip(new Date(2024, 0, 5), 1)], 'all', NOW);
    expect(bars).toHaveLength(12);
    expect(bars[11].label).toBe('Nov');
  });
});

test('trips saved before savings tracking (null) count as zero', () => {
  const bars = bucketTrips([trip(new Date(2026, 10, 5), null)], 'week', NOW);
  expect(bars[6].value).toBe(0);
});

describe('previousMonthTotal', () => {
  test('sums the calendar month before now', () => {
    const trips = [trip(new Date(2026, 9, 3), 10.2), trip(new Date(2026, 9, 28), 2), trip(new Date(2026, 10, 1), 99)];
    expect(previousMonthTotal(trips, NOW)).toBeCloseTo(12.2, 10);
  });

  test('is null when nothing was recorded that month', () => {
    expect(previousMonthTotal([trip(new Date(2026, 10, 1))], NOW)).toBeNull();
  });

  test('January looks back to December of the previous year', () => {
    const jan = new Date(2027, 0, 10);
    expect(previousMonthTotal([trip(new Date(2026, 11, 15), 3)], jan)).toBe(3);
  });
});

describe('periodRangeLabel', () => {
  test.each([
    ['month', 'November 2026'],
    ['year', '2026'],
    ['all', 'All time'],
    ['week', 'Oct 30 – Nov 5'],
  ] as const)('%s → %s', (period, expected) => {
    expect(periodRangeLabel(period, NOW)).toBe(expected);
  });
});
