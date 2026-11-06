import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { TripDetailScreen } from '@/features/trips/TripDetailScreen';

import { ApiError, mockApi } from '../helpers/api';
import { CAMRY, trip } from '../helpers/fixtures';
import { mockRouter, mockSearchParams, renderScreen, resetAppState } from '../helpers/render';

const TRIP = trip({ id: 'trip_1', destinationLabel: 'Pine Ridge Trailhead', distanceMiles: 31.2, estimatedCost: 9.04, savingsDollars: 2.09, savingsGallons: 0.35 });

function server(trips: unknown[] = [TRIP], extra: Record<string, unknown> = {}) {
  return mockApi({
    'GET /api/trips': trips,
    'GET /api/vehicle-profile': CAMRY,
    'DELETE /api/trips/*': null,
    ...extra,
  });
}

const open = (id = 'trip_1') => mockSearchParams.mockReturnValue({ id });

beforeEach(() => {
  resetAppState();
  open();
});

describe('the trip', () => {
  test('shows the destination, a Confirmed badge and when and in what car', async () => {
    server();
    await renderScreen(<TripDetailScreen />);

    expect(screen.getByText('Pine Ridge Trailhead')).toBeTruthy();
    expect(screen.getByText('Confirmed')).toBeTruthy();
    expect(screen.getByText(/· 2024 Toyota Camry LE\/SE$/)).toBeTruthy();
  });

  test('shows the savings against the fastest route', async () => {
    server();
    await renderScreen(<TripDetailScreen />);

    expect(screen.getByText('Estimated savings')).toBeTruthy();
    expect(screen.getByText('Compared with the fastest route')).toBeTruthy();
    expect(screen.getByText('+$2.09')).toBeTruthy();
  });

  test('lists distance, fuel avoided and the trip cost', async () => {
    server();
    await renderScreen(<TripDetailScreen />);

    expect(screen.getByText('31.2 mi')).toBeTruthy();
    expect(screen.getByText('0.35 gal')).toBeTruthy();
    expect(screen.getByText('$9.04')).toBeTruthy();
  });

  test('a trip that cost more shows a negative amount', async () => {
    server([trip({ id: 'trip_1', savingsDollars: -0.85 })]);
    await renderScreen(<TripDetailScreen />);
    expect(screen.getByText('−$0.85')).toBeTruthy();
  });

  test('a trip from before savings tracking has no savings card and a dash for fuel', async () => {
    server([trip({ id: 'trip_1', savingsDollars: null, savingsGallons: null })]);
    await renderScreen(<TripDetailScreen />);

    expect(screen.queryByText('Estimated savings')).toBeNull();
    expect(screen.getByText('—')).toBeTruthy();
  });

  test('explains how the estimate was made', async () => {
    server();
    await renderScreen(<TripDetailScreen />);
    expect(screen.getByText('About this estimate')).toBeTruthy();
  });

  test('shows the right trip when there are several', async () => {
    server([trip({ id: 'other', destinationLabel: 'Somewhere Else' }), TRIP]);
    await renderScreen(<TripDetailScreen />);
    expect(screen.getByText('Pine Ridge Trailhead')).toBeTruthy();
    expect(screen.queryByText('Somewhere Else')).toBeNull();
  });
});

describe('a trip that is not there', () => {
  test('says so and returns to the history', async () => {
    open('missing');
    server();
    await renderScreen(<TripDetailScreen />);

    expect(screen.getByText('Trip not found')).toBeTruthy();
    expect(screen.getByText('It may have been removed.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to trip history' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/trip-history');
  });
});

describe('removing a trip', () => {
  test('asks first, and does not delete anything yet', async () => {
    const api = server();
    await renderScreen(<TripDetailScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Remove trip' }));

    expect(screen.getByText('Remove this trip?')).toBeTruthy();
    expect(screen.getByText(/Its savings will be taken out of your totals/)).toBeTruthy();
    expect(api.callsTo('DELETE')).toHaveLength(0);
  });

  test('"Keep trip" backs out', async () => {
    const api = server();
    await renderScreen(<TripDetailScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Remove trip' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Keep trip' }));

    expect(screen.queryByText('Remove this trip?')).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove trip' })).toBeTruthy();
    expect(api.callsTo('DELETE')).toHaveLength(0);
  });

  test('"Remove" deletes that trip and returns to the history', async () => {
    const api = server();
    await renderScreen(<TripDetailScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Remove trip' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(api.callsTo('DELETE /api/trips/trip_1')).toHaveLength(1));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/trip-history'));
  });

  test('a failed delete says so and stays on the trip', async () => {
    server([TRIP], { 'DELETE /api/trips/*': new ApiError(500) });
    await renderScreen(<TripDetailScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Remove trip' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Remove' }));

    expect(await screen.findByText("Couldn't remove this trip. Try again.")).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(screen.getByText('Pine Ridge Trailhead')).toBeTruthy();
  });
});

describe('navigation', () => {
  test('the back button goes back, or to the history when there is nothing to go back to', async () => {
    server();
    await renderScreen(<TripDetailScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalled();

    mockRouter.canGoBack.mockReturnValue(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/trip-history');
  });
});
