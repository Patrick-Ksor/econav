import { TripHistoryEntry } from '@/schemas/routing';

const MONTH_LONG = new Intl.DateTimeFormat('en-US', { month: 'long' });
const MONTH_YEAR = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

export interface TripGroup {
  title: string;
  trips: TripHistoryEntry[];
}

function groupTitle(date: Date, now: Date): string {
  const msPerDay = 86_400_000;
  if (now.getTime() - date.getTime() < 7 * msPerDay) return 'Last 7 days';
  if (date.getFullYear() === now.getFullYear()) return `Earlier in ${MONTH_LONG.format(date)}`;
  return MONTH_YEAR.format(date);
}

/** Groups newest-first trips into "Last 7 days" / "Earlier in <month>" / "<month> <year>" sections. */
export function groupTrips(trips: TripHistoryEntry[], now: Date = new Date()): TripGroup[] {
  const groups: TripGroup[] = [];
  for (const trip of trips) {
    const title = groupTitle(new Date(trip.createdAt), now);
    const last = groups[groups.length - 1];
    if (last && last.title === title) {
      last.trips.push(trip);
    } else {
      groups.push({ title, trips: [trip] });
    }
  }
  return groups;
}
