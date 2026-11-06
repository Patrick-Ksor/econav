import { fireEvent, screen } from '@testing-library/react-native';

import { TripHistoryScreen } from '@/features/trips/TripHistoryScreen';
import { useTripStore, type PendingTrip } from '@/stores/trip-store';

import { mockApi } from '../helpers/api';
import { CAMRY, trip } from '../helpers/fixtures';
import { mockRouter, renderScreen, resetAppState } from '../helpers/render';

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000 - 3_600_000).toISOString();

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

const RECENT = trip({ id: 'a', destinationLabel: 'Greenway Market', createdAt: daysAgo(1), savingsDollars: 1.16, estimatedCost: 2.38 });
const LOSS = trip({ id: 'b', destinationLabel: 'Lakeside Stadium', createdAt: daysAgo(2), savingsDollars: -0.85, distanceMiles: 14.6, estimatedCost: 5.98 });
const OLD = trip({ id: 'c', destinationLabel: 'Downtown Library', createdAt: daysAgo(60), savingsDollars: 0.4 });
const UNTRACKED = trip({ id: 'd', destinationLabel: 'Old Trip', createdAt: daysAgo(3), savingsDollars: null, estimatedCost: 3.1 });

const server = (trips: unknown[]) =>
  mockApi({ 'GET /api/trips': trips, 'GET /api/vehicle-profile': CAMRY });

beforeEach(resetAppState);

describe('trip list', () => {
  test('groups recent trips under "Last 7 days" and older ones separately', async () => {
    server([RECENT, LOSS, OLD]);
    await renderScreen(<TripHistoryScreen />);

    expect(screen.getByText('Last 7 days')).toBeTruthy();
    expect(screen.getByText('Greenway Market')).toBeTruthy();
    expect(screen.getByText('Downtown Library')).toBeTruthy();
    // The 60-day-old trip is under a month heading, not the recent group.
    expect(screen.getAllByText(/^(Earlier in [A-Z][a-z]+|[A-Z][a-z]+ \d{4})$/).length).toBeGreaterThan(0);
  });

  test('shows distance, cost and savings against the fastest route', async () => {
    server([RECENT]);
    await renderScreen(<TripHistoryScreen />);

    expect(screen.getByText('8.2 mi')).toBeTruthy();
    expect(screen.getByText('$2.38')).toBeTruthy();
    expect(screen.getByText('+$1.16')).toBeTruthy();
  });

  test('a trip that cost more shows a negative amount with a minus sign', async () => {
    server([LOSS]);
    await renderScreen(<TripHistoryScreen />);
    expect(screen.getByText('−$0.85')).toBeTruthy();
  });

  test('a trip from before savings tracking shows a dash', async () => {
    server([UNTRACKED]);
    await renderScreen(<TripHistoryScreen />);
    expect(screen.getByText('—')).toBeTruthy();
  });

  test('every saved trip is labelled Confirmed', async () => {
    server([RECENT, LOSS]);
    await renderScreen(<TripHistoryScreen />);
    expect(screen.getAllByText('Confirmed')).toHaveLength(2 + 1); // two badges + the filter chip
  });

  test('opens the trip detail when a trip is tapped', async () => {
    server([RECENT]);
    await renderScreen(<TripHistoryScreen />);
    await fireEvent.press(screen.getByText('Greenway Market'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/trip-detail', params: { id: 'a' } });
  });

  test('the back arrow goes back, or home when there is no history', async () => {
    server([RECENT]);
    await renderScreen(<TripHistoryScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalled();

    mockRouter.canGoBack.mockReturnValue(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/home');
  });
});

describe('a pending trip', () => {
  test('appears first under "Needs confirming" with a Pending badge', async () => {
    useTripStore.setState({ pendingTrip: PENDING });
    server([RECENT]);
    await renderScreen(<TripHistoryScreen />);

    expect(screen.getByText('Needs confirming')).toBeTruthy();
    expect(screen.getByText('Harbor View Office Park')).toBeTruthy();
    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
  });

  test('opens the confirm screen, not the detail screen', async () => {
    useTripStore.setState({ pendingTrip: PENDING });
    server([]);
    await renderScreen(<TripHistoryScreen />);
    await fireEvent.press(screen.getByText('Harbor View Office Park'));
    expect(mockRouter.push).toHaveBeenCalledWith('/trip-summary');
  });

  test('is hidden by the Confirmed filter', async () => {
    useTripStore.setState({ pendingTrip: PENDING });
    server([RECENT]);
    await renderScreen(<TripHistoryScreen />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Confirmed' }));

    expect(screen.queryByText('Harbor View Office Park')).toBeNull();
    expect(screen.getByText('Greenway Market')).toBeTruthy();
  });

  test('is all the Pending filter shows', async () => {
    useTripStore.setState({ pendingTrip: PENDING });
    server([RECENT]);
    await renderScreen(<TripHistoryScreen />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Pending' }));

    expect(screen.getByText('Harbor View Office Park')).toBeTruthy();
    expect(screen.queryByText('Greenway Market')).toBeNull();
  });

  test('the Pending filter says so when nothing is waiting', async () => {
    server([RECENT]);
    await renderScreen(<TripHistoryScreen />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Pending' }));
    expect(screen.getByText('No trips waiting to be confirmed.')).toBeTruthy();
  });
});

describe('with no trips at all', () => {
  test('shows the empty state and sends the user to plan one', async () => {
    server([]);
    await renderScreen(<TripHistoryScreen />);

    expect(screen.getByText('No trips yet')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Plan your first trip' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/routes');
  });

  test('a lone pending trip means it is not empty', async () => {
    useTripStore.setState({ pendingTrip: PENDING });
    server([]);
    await renderScreen(<TripHistoryScreen />);
    expect(screen.queryByText('No trips yet')).toBeNull();
  });
});
