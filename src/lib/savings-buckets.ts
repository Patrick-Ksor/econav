import { TripHistoryEntry } from '@/schemas/routing';

export type SavingsPeriod = 'week' | 'month' | 'year' | 'all';

export interface SavingsBar {
  label: string;
  value: number;
}

const WEEKDAY_INITIAL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_SHORT = new Intl.DateTimeFormat('en-US', { month: 'short' });
const MONTH_LONG = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const MONTH_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const MAX_MONTH_BARS = 12;

const saved = (t: TripHistoryEntry) => t.savingsDollars ?? 0;

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** Trips falling inside the period; "all" keeps everything loaded. */
export function tripsInPeriod(trips: TripHistoryEntry[], period: SavingsPeriod, now: Date): TripHistoryEntry[] {
  if (period === 'all') return trips;
  if (period === 'month') return trips.filter((t) => sameMonth(new Date(t.createdAt), now));
  if (period === 'year') return trips.filter((t) => new Date(t.createdAt).getFullYear() === now.getFullYear());
  const start = new Date(now);
  start.setDate(now.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return trips.filter((t) => new Date(t.createdAt) >= start);
}

/** Bars for the chart: last 7 days, weeks of this month, or months (oldest loaded → now). */
export function bucketTrips(trips: TripHistoryEntry[], period: SavingsPeriod, now: Date): SavingsBar[] {
  if (period === 'week') {
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(now);
      day.setDate(now.getDate() - (6 - i));
      return {
        label: WEEKDAY_INITIAL[day.getDay()],
        value: trips.filter((t) => sameDay(new Date(t.createdAt), day)).reduce((s, t) => s + saved(t), 0),
      };
    });
  }

  if (period === 'month') {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentWeek = Math.floor((now.getDate() - 1) / 7);
    return Array.from({ length: currentWeek + 1 }, (_, w) => {
      const first = w * 7 + 1;
      const last = Math.min(first + 6, daysInMonth);
      return {
        label: `${first}–${last}`,
        value: trips
          .filter((t) => {
            const d = new Date(t.createdAt);
            return sameMonth(d, now) && d.getDate() >= first && d.getDate() <= last;
          })
          .reduce((s, t) => s + saved(t), 0),
      };
    });
  }

  if (period === 'year') {
    // January through the current month of this calendar year.
    return Array.from({ length: now.getMonth() + 1 }, (_, m) => ({
      label: MONTH_SHORT.format(new Date(now.getFullYear(), m, 1)),
      value: trips
        .filter((t) => sameMonth(new Date(t.createdAt), new Date(now.getFullYear(), m, 1)))
        .reduce((sum, t) => sum + saved(t), 0),
    }));
  }

  // all: one bar per month from the oldest loaded trip, capped to the latest 12.
  const oldest = trips.reduce((min, t) => Math.min(min, new Date(t.createdAt).getTime()), now.getTime());
  const start = new Date(oldest);
  const monthsBack = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  const count = Math.min(monthsBack + 1, MAX_MONTH_BARS);
  return Array.from({ length: count }, (_, i) => {
    const month = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
    return {
      label: MONTH_SHORT.format(month),
      value: trips.filter((t) => sameMonth(new Date(t.createdAt), month)).reduce((s, t) => s + saved(t), 0),
    };
  });
}

export function periodRangeLabel(period: SavingsPeriod, now: Date): string {
  if (period === 'month') return MONTH_LONG.format(now);
  if (period === 'year') return String(now.getFullYear());
  if (period === 'all') return 'All time';
  const start = new Date(now);
  start.setDate(now.getDate() - 6);
  return `${MONTH_DAY.format(start)} – ${MONTH_DAY.format(now)}`;
}

/** Total saved in the calendar month before `now`, or null if no trip falls in it. */
export function previousMonthTotal(trips: TripHistoryEntry[], now: Date): number | null {
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const inPrev = trips.filter((t) => sameMonth(new Date(t.createdAt), prev));
  return inPrev.length === 0 ? null : inPrev.reduce((s, t) => s + saved(t), 0);
}
