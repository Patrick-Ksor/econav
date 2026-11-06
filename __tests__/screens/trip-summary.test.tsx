import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { TripSummaryScreen } from '@/features/routes/TripSummaryScreen';
import { useTripStore, type PendingTrip } from '@/stores/trip-store';

import { ApiError, mockApi, type ApiCall } from '../helpers/api';
import { mockRouter, renderScreen, resetAppState } from '../helpers/render';

const STARTED_AT = new Date(2026, 9, 27, 10, 42).toISOString();

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
  savingsGallons: 0.21,
  startedAt: STARTED_AT,
};

const SUMMARY = { tripCount: 26, totalSavingsDollars: 128.45, totalSavingsGallons: 8.4, monthSavingsDollars: 34.2 };

const pend = (overrides: Partial<PendingTrip> = {}) => useTripStore.setState({ pendingTrip: { ...PENDING, ...overrides } });

/** A server that accepts trips (echoing them back, as the real one does) and reports lifetime totals. */
const server = (extra: Record<string, unknown> = {}) =>
  mockApi({
    'GET /api/trips/summary': SUMMARY,
    'POST /api/trips': ({ body }: ApiCall) => body,
    ...extra,
  });

beforeEach(resetAppState);

describe('the trip being confirmed', () => {
  test('shows where you went and how the route compared', async () => {
    server();
    pend();
    await renderScreen(<TripSummaryScreen />);

    expect(screen.getByText('Welcome back. How did it go?')).toBeTruthy();
    expect(screen.getByText('Current location')).toBeTruthy();
    expect(screen.getByText('Harbor View Office Park')).toBeTruthy();
    expect(screen.getByText('Efficient')).toBeTruthy();
    expect(screen.getByText('25.9 mi')).toBeTruthy();
    expect(screen.getByText('33 min')).toBeTruthy();
    expect(screen.getByText('$7.50')).toBeTruthy(); // your route
    expect(screen.getByText('$11.55')).toBeTruthy(); // the fastest-route baseline
  });

  test('presents the savings as an estimate', async () => {
    server();
    pend();
    await renderScreen(<TripSummaryScreen />);

    expect(screen.getByText('+$4.05')).toBeTruthy();
    expect(screen.getByText(/This is an estimate compared with the fastest route/)).toBeTruthy();
  });

  test('says how much longer it took than the fastest route', async () => {
    server();
    pend({ durationMinutes: 33, baselineMinutes: 29 });
    await renderScreen(<TripSummaryScreen />);
    expect(screen.getByText('4 min longer than fastest')).toBeTruthy();
  });

  test('says when it was quicker, or the same', async () => {
    server();
    pend({ durationMinutes: 25, baselineMinutes: 29 });
    await renderScreen(<TripSummaryScreen />);
    expect(screen.getByText('4 min faster than fastest')).toBeTruthy();
  });

  test('a route that cost more shows a negative estimate', async () => {
    server();
    pend({ savingsDollars: -0.85, cost: 12.4 });
    await renderScreen(<TripSummaryScreen />);
    expect(screen.getByText('−$0.85')).toBeTruthy();
  });

  test('picking the baseline route itself saves nothing', async () => {
    server();
    pend({ savingsDollars: 0, durationMinutes: 29 });
    await renderScreen(<TripSummaryScreen />);
    expect(screen.getByText('+$0.00')).toBeTruthy();
    expect(screen.getByText('Same time as fastest')).toBeTruthy();
  });
});

describe('Confirm trip', () => {
  test('saves the trip, including its savings, under the time the trip started', async () => {
    const api = server();
    pend();
    await renderScreen(<TripSummaryScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm trip' }));

    await waitFor(() => expect(api.callsTo('POST /api/trips')).toHaveLength(1));
    expect(api.callsTo('POST /api/trips')[0].body).toMatchObject({
      destinationLabel: 'Harbor View Office Park',
      distanceMiles: 25.9,
      estimatedCost: 7.5,
      createdAt: STARTED_AT,
      savingsDollars: 4.05,
      savingsGallons: 0.21,
    });
    await screen.findByText('Trip confirmed'); // let the screen finish updating before the test ends
  });

  test('shows a success screen with the new lifetime total', async () => {
    const api = server();
    pend();
    await renderScreen(<TripSummaryScreen />);
    await waitFor(() => expect(api.callsTo('GET /api/trips/summary')).toHaveLength(1)); // totals loaded first
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm trip' }));

    expect(await screen.findByText('Trip confirmed')).toBeTruthy();
    expect(screen.getByText('+$4.05')).toBeTruthy();
    expect(screen.getByText('added to your estimated savings')).toBeTruthy();
    expect(screen.getByText('$132.50')).toBeTruthy(); // 128.45 + 4.05
  });

  test('clears the pending trip so it is not confirmed twice', async () => {
    server();
    pend();
    await renderScreen(<TripSummaryScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm trip' }));

    await screen.findByText('Trip confirmed');
    expect(useTripStore.getState().pendingTrip).toBeNull();
  });

  test('"Done" goes to Savings', async () => {
    server();
    pend();
    await renderScreen(<TripSummaryScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm trip' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Done' }));

    expect(mockRouter.replace).toHaveBeenCalledWith('/savings');
  });

  test('a failed save keeps the trip pending and says so', async () => {
    server({ 'POST /api/trips': new ApiError(500) });
    pend();
    await renderScreen(<TripSummaryScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm trip' }));

    expect(await screen.findByText("Couldn't save this trip. Check your connection and try again.")).toBeTruthy();
    expect(screen.queryByText('Trip confirmed')).toBeNull();
    expect(useTripStore.getState().pendingTrip).not.toBeNull();
  });
});

describe('leaving without confirming', () => {
  test('"Discard trip" drops it without saving anything', async () => {
    const api = server();
    pend();
    await renderScreen(<TripSummaryScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Discard trip' }));

    expect(useTripStore.getState().pendingTrip).toBeNull();
    expect(api.callsTo('POST')).toHaveLength(0);
    expect(mockRouter.replace).toHaveBeenCalledWith('/home');
  });

  test('closing the screen keeps the trip pending for later', async () => {
    const api = server();
    pend();
    await renderScreen(<TripSummaryScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));

    expect(useTripStore.getState().pendingTrip).not.toBeNull();
    expect(api.callsTo('POST')).toHaveLength(0);
    expect(mockRouter.replace).toHaveBeenCalledWith('/home');
  });
});

describe('with nothing to confirm', () => {
  test('explains and offers a way home', async () => {
    server();
    await renderScreen(<TripSummaryScreen />);

    expect(screen.getByText('Nothing to confirm')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Home' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/home');
  });
});
