import { groupTrips } from '@/lib/trip-groups';
import type { TripHistoryEntry } from '@/schemas/routing';

const NOW = new Date(2026, 9, 27, 12, 0); // Tue Oct 27 2026

const trip = (id: string, when: Date): TripHistoryEntry => ({
  id,
  destinationLabel: id,
  distanceMiles: 1,
  estimatedCost: 1,
  createdAt: when.toISOString(),
  savingsDollars: 0,
  savingsGallons: 0,
});

describe('groupTrips', () => {
  test('puts the last 7 days first', () => {
    const groups = groupTrips([trip('a', new Date(2026, 9, 27, 9)), trip('b', new Date(2026, 9, 22))], NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe('Last 7 days');
    expect(groups[0].trips.map((t) => t.id)).toEqual(['a', 'b']);
  });

  test('older trips this year are grouped as "Earlier in <month>"', () => {
    const groups = groupTrips([trip('a', new Date(2026, 9, 27, 9)), trip('b', new Date(2026, 9, 3))], NOW);
    expect(groups.map((g) => g.title)).toEqual(['Last 7 days', 'Earlier in October']);
  });

  test('keeps each month separate, in the order given (newest first)', () => {
    const groups = groupTrips(
      [trip('a', new Date(2026, 9, 3)), trip('b', new Date(2026, 8, 20)), trip('c', new Date(2026, 8, 2))],
      NOW,
    );
    expect(groups.map((g) => g.title)).toEqual(['Earlier in October', 'Earlier in September']);
    expect(groups[1].trips.map((t) => t.id)).toEqual(['b', 'c']);
  });

  test('trips from a previous year show the month and year', () => {
    const groups = groupTrips([trip('a', new Date(2025, 11, 30))], NOW);
    expect(groups[0].title).toBe('December 2025');
  });

  test('exactly 7 days ago is no longer "Last 7 days"', () => {
    const groups = groupTrips([trip('a', new Date(2026, 9, 20, 12))], NOW);
    expect(groups[0].title).toBe('Earlier in October');
  });

  test('no trips means no groups', () => {
    expect(groupTrips([], NOW)).toEqual([]);
  });
});
