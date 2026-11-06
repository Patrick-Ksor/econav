import { fireEvent, screen } from '@testing-library/react-native';

import { HomeScreen } from '@/features/home/HomeScreen';
import { useTripStore, type PendingTrip } from '@/stores/trip-store';

import { mockApi } from '../helpers/api';
import { CAMRY, trip } from '../helpers/fixtures';
import { mockRouter, renderScreen, resetAppState } from '../helpers/render';

const SUMMARY = { tripCount: 26, totalSavingsDollars: 128.45, totalSavingsGallons: 8.4, monthSavingsDollars: 34.2 };
const PREFS = { priority: 'balance', timeValuePerHour: 18, includeTolls: true };

const PENDING: PendingTrip = {
  originLabel: 'Current location',
  destinationLabel: 'Harbor View Office Park',
  routeLabel: 'Efficient',
  routeColor: '#14532D',
  distanceMiles: 25.9,
  durationMinutes: 33,
  cost: 7.5,
  baselineCost: 11.55,
  baselineMinutes: 29,
  savingsDollars: 4.05,
  savingsGallons: 0.2,
  startedAt: new Date().toISOString(),
};

function server(opts: { vehicle?: unknown; trips?: unknown[]; prefs?: unknown } = {}) {
  return mockApi({
    'GET /api/vehicle-profile': opts.vehicle === undefined ? CAMRY : opts.vehicle,
    'GET /api/trips': opts.trips ?? [],
    'GET /api/trips/summary': SUMMARY,
    'GET /api/route-preferences': opts.prefs ?? PREFS,
  });
}

beforeEach(resetAppState);

describe('without a vehicle', () => {
  test('asks the user to add one instead of showing empty numbers', async () => {
    server({ vehicle: null });
    await renderScreen(<HomeScreen />);

    expect(screen.getByText('Add a vehicle to see real costs')).toBeTruthy();
    expect(screen.queryByText('Total Savings')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Add Vehicle' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/add-vehicle');
  });
});

describe('dashboard', () => {
  test('greets the user by first name, with their initials as the avatar', async () => {
    server();
    await renderScreen(<HomeScreen />);

    expect(screen.getByText(/^Good (morning|afternoon|evening), Maya$/)).toBeTruthy();
    expect(screen.getByText('MC')).toBeTruthy();
  });

  test('shows the active vehicle and routing priority', async () => {
    server();
    await renderScreen(<HomeScreen />);

    expect(screen.getByText(/2024 Toyota Camry LE\/SE/)).toBeTruthy();
    expect(screen.getByText(/24 MPG/)).toBeTruthy();
    expect(screen.getByText('Balanced')).toBeTruthy();
  });

  test.each([
    ['cost', 'Lowest cost'],
    ['fast', 'Fastest'],
  ])('priority %s reads "%s"', async (priority, label) => {
    server({ prefs: { ...PREFS, priority } });
    await renderScreen(<HomeScreen />);
    expect(screen.getByText(label)).toBeTruthy();
  });

  test('the savings card shows totals, this month and fuel avoided', async () => {
    server();
    await renderScreen(<HomeScreen />);

    expect(screen.getByText('Total Savings')).toBeTruthy();
    expect(screen.getByText('Estimated')).toBeTruthy();
    expect(screen.getByText('$128.45')).toBeTruthy();
    expect(screen.getByText('vs. standard routes · 26 trips optimized')).toBeTruthy();
    expect(screen.getByText('$34.20')).toBeTruthy();
    expect(screen.getByText('8.4 gal')).toBeTruthy();
  });

  test.each([
    ['Plan a route', '/routes'],
    ['Change vehicle', '/garage'],
    ['Route preferences', '/route-preferences'],
    ['Open savings', '/savings'],
    ['Profile', '/profile'],
  ])('"%s" navigates to %s', async (name, route) => {
    server();
    await renderScreen(<HomeScreen />);
    await fireEvent.press(screen.getByRole('button', { name }));
    expect(mockRouter.push).toHaveBeenCalledWith(route);
  });

  test('the quick tiles open Add vehicle and Trip history', async () => {
    server();
    await renderScreen(<HomeScreen />);

    await fireEvent.press(screen.getByText('Add vehicle'));
    expect(mockRouter.push).toHaveBeenCalledWith('/add-vehicle');
    await fireEvent.press(screen.getByText('Trip history'));
    expect(mockRouter.push).toHaveBeenCalledWith('/trip-history');
  });
});

describe('recent trips', () => {
  test('shows only the latest three, with savings and a Confirmed status', async () => {
    const trips = ['A', 'B', 'C', 'D'].map((n, i) =>
      trip({ id: n, destinationLabel: `Stop ${n}`, createdAt: new Date(Date.now() - (i + 1) * 3_600_000).toISOString() }),
    );
    server({ trips });
    await renderScreen(<HomeScreen />);

    expect(screen.getByText('Stop A')).toBeTruthy();
    expect(screen.getByText('Stop C')).toBeTruthy();
    expect(screen.queryByText('Stop D')).toBeNull();
    expect(screen.getAllByText('Confirmed')).toHaveLength(3);
  });

  test('"See all" and a trip row both navigate', async () => {
    server({ trips: [trip({ id: 'a', destinationLabel: 'Greenway Market' })] });
    await renderScreen(<HomeScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'See all' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/trip-history');
    await fireEvent.press(screen.getByText('Greenway Market'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/trip-detail', params: { id: 'a' } });
  });

  test('with no trips, says so and hides "See all"', async () => {
    server({ trips: [] });
    await renderScreen(<HomeScreen />);

    expect(screen.getByText('No trips yet — plan a route to see it here.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'See all' })).toBeNull();
  });
});

describe('a trip waiting to be confirmed', () => {
  test('is surfaced with the savings it would add', async () => {
    useTripStore.setState({ pendingTrip: PENDING });
    server();
    await renderScreen(<HomeScreen />);

    expect(screen.getByText('Back from Harbor View Office Park?')).toBeTruthy();
    expect(screen.getByText('Confirm your trip to add an estimated $4.05.')).toBeTruthy();
  });

  test('opens the confirm screen', async () => {
    useTripStore.setState({ pendingTrip: PENDING });
    server();
    await renderScreen(<HomeScreen />);
    await fireEvent.press(screen.getByText('Back from Harbor View Office Park?'));
    expect(mockRouter.push).toHaveBeenCalledWith('/trip-summary');
  });

  test("doesn't promise savings when the route cost more", async () => {
    useTripStore.setState({ pendingTrip: { ...PENDING, savingsDollars: -0.85 } });
    server();
    await renderScreen(<HomeScreen />);
    expect(screen.getByText('Confirm your trip to log it.')).toBeTruthy();
    expect(screen.queryByText(/Confirm your trip to add an estimated/)).toBeNull();
  });

  test('is absent when nothing is pending', async () => {
    server();
    await renderScreen(<HomeScreen />);
    expect(screen.queryByText(/Back from/)).toBeNull();
  });
});
