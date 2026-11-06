import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { RouteCompareScreen } from '@/features/routes/RouteCompareScreen';
import type { ComputedRouteOption } from '@/schemas/routing';
import { computeFuelAwareRoutesRaw } from '@/services/mapbox';
import { openInExternalMap } from '@/services/map-launcher';
import { useTripStore } from '@/stores/trip-store';

import { ApiError, mockApi } from '../helpers/api';
import { CAMRY } from '../helpers/fixtures';
import { mockRouter, renderScreen, resetAppState } from '../helpers/render';

// Routing and the maps launcher are the only external boundaries; everything else is real.
jest.mock('@/services/mapbox', () => ({
  ...jest.requireActual('@/services/mapbox'),
  computeFuelAwareRoutesRaw: jest.fn(),
}));
jest.mock('@/services/map-launcher', () => ({
  ...jest.requireActual('@/services/map-launcher'),
  openInExternalMap: jest.fn(async () => {}),
  isAppleMapsAvailable: jest.fn(() => false),
}));

const compute = computeFuelAwareRoutesRaw as jest.Mock;
const launch = openInExternalMap as jest.Mock;

const ORIGIN = { lat: 35.15, lng: -80.93 };
const DEST = { lat: 35.1, lng: -80.88 };
// Google's documented polyline, reused as plausible route geometry for the map.
const POLY_A = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
const POLY_B = '_p~iF~ps|U_ulLnnqC';

const option = (kind: ComputedRouteOption['kind'], miles: number, minutes: number, polyline: string): ComputedRouteOption => ({
  kind,
  distanceMiles: miles,
  durationMinutes: minutes,
  gallonsUsed: miles / 24,
  estimatedCost: 0,
  encodedPolyline: polyline,
});

// With the Camry (24 MPG, $3.60/gal, $0.18/mi):
//   Efficient 24.6 mi → 24.6/24×3.60 + 24.6×0.18 = 3.69 + 4.428 = $8.118, 41 min
//   Fastest   27.8 mi → 27.8/24×3.60 + 27.8×0.18 = 4.17 + 5.004 = $9.174, 29 min
const TWO_ROUTES = {
  optimized: option('fuel_efficient', 24.6, 41, POLY_A),
  standard: option('standard', 27.8, 29, POLY_B),
};

const PREFS = { priority: 'balance', timeValuePerHour: 18, includeTolls: true };

function setup(opts: { vehicle?: unknown; prefs?: unknown; routes?: unknown } = {}) {
  useTripStore.setState({
    lastRouteQuery: {
      origin: { label: 'Current location', location: ORIGIN },
      destination: { label: 'Target', location: DEST },
    },
  });
  compute.mockReset();
  compute.mockResolvedValue(opts.routes ?? TWO_ROUTES);
  launch.mockClear();
  return mockApi({
    'GET /api/vehicle-profile': opts.vehicle === undefined ? CAMRY : opts.vehicle,
    'GET /api/route-preferences': opts.prefs ?? PREFS,
  });
}

// The routing hook retries once with a 1s backoff before showing the error screen.
const ERROR_WAIT = { timeout: 4000 };

const select = (label: string) => fireEvent.press(screen.getByRole('radio', { name: `Select ${label} route` }));

beforeEach(resetAppState);

describe('the two routes', () => {
  test('are priced from the active vehicle: fuel ÷ MPG × price, plus depreciation', async () => {
    setup();
    await renderScreen(<RouteCompareScreen />);

    // Labels repeat in the cards and the ranking boxes, so check they're present at least once.
    expect(screen.getAllByText('Efficient').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Fastest').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$8.12').length).toBeGreaterThan(0); // Efficient
    expect(screen.getAllByText('$9.17').length).toBeGreaterThan(0); // Fastest
  });

  test('show distance, duration and the fuel / depreciation split', async () => {
    setup();
    await renderScreen(<RouteCompareScreen />);

    expect(screen.getByText(/24\.6 mi · Arrive/)).toBeTruthy();
    expect(screen.getByText(/27\.8 mi · Arrive/)).toBeTruthy();
    expect(screen.getByText('41 min')).toBeTruthy();
    expect(screen.getByText('29 min')).toBeTruthy();
    expect(screen.getByText('$3.69')).toBeTruthy(); // Efficient fuel
    expect(screen.getByText('$4.43')).toBeTruthy(); // Efficient depreciation
  });

  test("use the vehicle's depreciation, so a different car changes the price", async () => {
    setup({ vehicle: { ...CAMRY, depreciationPerMile: 0.5 } });
    await renderScreen(<RouteCompareScreen />);
    // 24.6 × 0.50 = 12.30 depreciation + 3.69 fuel = 15.99
    expect(screen.getAllByText('$15.99').length).toBeGreaterThan(0);
  });

  test('say how each differs from the other', async () => {
    setup();
    await renderScreen(<RouteCompareScreen />);

    expect(screen.getByText('$1.06 less than fastest')).toBeTruthy(); // 9.174 − 8.118
    expect(screen.getByText('12 min longer than fastest')).toBeTruthy();
    expect(screen.getByText('$1.06 more than efficient')).toBeTruthy();
    expect(screen.getByText('12 min faster than efficient')).toBeTruthy();
  });

  test('ask the routing service for this origin and destination', async () => {
    setup();
    await renderScreen(<RouteCompareScreen />);
    expect(compute).toHaveBeenCalledWith(ORIGIN, DEST, 24, 3.6);
  });
});

describe('the recommendation', () => {
  test('balance at $18/hr recommends Fastest: 12 minutes is worth more than $1.06', async () => {
    setup();
    await renderScreen(<RouteCompareScreen />);

    expect(screen.getAllByText('Recommended')).toHaveLength(1);
    expect(screen.getByRole('radio', { name: 'Select Fastest route', checked: true })).toBeTruthy();
    expect(screen.getByText(/Why this route:/)).toBeTruthy();
    expect(screen.getByText(/costs an estimated \$1\.06 more than the efficient route and takes 12 minutes less/)).toBeTruthy();
  });

  test('lowest cost recommends Efficient', async () => {
    setup({ prefs: { ...PREFS, priority: 'cost' } });
    await renderScreen(<RouteCompareScreen />);

    expect(screen.getByRole('radio', { name: 'Select Efficient route', checked: true })).toBeTruthy();
    expect(screen.getByText(/You asked for the lowest cost\./)).toBeTruthy();
  });

  test('a free-time preference recommends Efficient even under balance', async () => {
    setup({ prefs: { ...PREFS, timeValuePerHour: 0 } });
    await renderScreen(<RouteCompareScreen />);
    expect(screen.getByRole('radio', { name: 'Select Efficient route', checked: true })).toBeTruthy();
  });

  test('fastest recommends Fastest', async () => {
    setup({ prefs: { ...PREFS, priority: 'fast' } });
    await renderScreen(<RouteCompareScreen />);
    expect(screen.getByText(/You asked for the fastest arrival\./)).toBeTruthy();
  });

  test('the preference chip names the priority', async () => {
    setup({ prefs: { ...PREFS, priority: 'cost' } });
    await renderScreen(<RouteCompareScreen />);
    expect(screen.getByText('Lowest cost')).toBeTruthy();
  });

  test('the user can pick the other route; the footer follows', async () => {
    setup();
    await renderScreen(<RouteCompareScreen />);
    await select('Efficient');

    expect(screen.getByRole('radio', { name: 'Select Efficient route', checked: true })).toBeTruthy();
    expect(screen.getByText('Starts the efficient route ($8.12) in Google Maps')).toBeTruthy();
  });

  test('the cost breakdown explains the selected route with its formulas', async () => {
    setup();
    await renderScreen(<RouteCompareScreen />);
    await select('Efficient');

    expect(screen.getByText('How $8.12 is calculated')).toBeTruthy();
    expect(screen.getByText('24.6 mi ÷ 24 MPG × $3.60/gal')).toBeTruthy();
    expect(screen.getByText('24.6 mi × $0.18/mi')).toBeTruthy();
  });

  test('the ranking scores (time value) appear only under balance', async () => {
    setup();
    await renderScreen(<RouteCompareScreen />);
    expect(screen.getByText(/Time value/)).toBeTruthy();
  });

  test('…and not under lowest cost', async () => {
    setup({ prefs: { ...PREFS, priority: 'cost' } });
    await renderScreen(<RouteCompareScreen />);
    expect(screen.queryByText(/Time value/)).toBeNull();
  });
});

describe('when route preferences fail to load', () => {
  test('still compares routes, using the default priority', async () => {
    setup({ prefs: new ApiError(500) });
    await renderScreen(<RouteCompareScreen />);

    // A failed settings request must not block the core feature: it shows routes, ranked by the
    // default (balance at $18/hr), rather than sitting on the loading skeleton forever.
    expect(await screen.findByText('Compare routes')).toBeTruthy();
    expect(screen.queryByText('Finding the best routes…')).toBeNull();
    expect(screen.getByRole('radio', { name: 'Select Fastest route', checked: true })).toBeTruthy();
  });
});

describe('when Mapbox returns the same road twice', () => {
  const SAME = { optimized: option('fuel_efficient', 10, 20, POLY_A), standard: option('standard', 10.01, 20.1, POLY_A) };

  test('shows one "Best route" and no fake comparison', async () => {
    setup({ routes: SAME });
    await renderScreen(<RouteCompareScreen />);

    expect(screen.getAllByText('Best route').length).toBeGreaterThan(0);
    expect(screen.queryByText('Efficient')).toBeNull();
    expect(screen.queryByText(/Why this route/)).toBeNull();
    expect(screen.getByText(/1 route found/)).toBeTruthy();
  });
});

describe('Open in Maps', () => {
  test('starts the trip as pending, with the numbers the user saw', async () => {
    setup();
    await renderScreen(<RouteCompareScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Open in Maps' }));

    await waitFor(() => expect(useTripStore.getState().pendingTrip).not.toBeNull());
    expect(useTripStore.getState().pendingTrip).toMatchObject({
      originLabel: 'Current location',
      destinationLabel: 'Target',
      routeLabel: 'Fastest', // the recommended one
      distanceMiles: 27.8,
      durationMinutes: 29,
      baselineMinutes: 29,
    });
    expect(useTripStore.getState().pendingTrip!.cost).toBeCloseTo(9.174, 3);
  });

  test('choosing the baseline route itself saves nothing', async () => {
    setup();
    await renderScreen(<RouteCompareScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Open in Maps' }));

    await waitFor(() => expect(useTripStore.getState().pendingTrip).not.toBeNull());
    expect(useTripStore.getState().pendingTrip!.savingsDollars).toBeCloseTo(0, 10);
    expect(useTripStore.getState().pendingTrip!.savingsGallons).toBeCloseTo(0, 10);
  });

  test('the cheaper route is credited with the difference from the fastest, in dollars and gallons', async () => {
    setup();
    await renderScreen(<RouteCompareScreen />);
    await select('Efficient');
    await fireEvent.press(screen.getByRole('button', { name: 'Open in Maps' }));

    await waitFor(() => expect(useTripStore.getState().pendingTrip).not.toBeNull());
    const pending = useTripStore.getState().pendingTrip!;
    expect(pending.routeLabel).toBe('Efficient');
    expect(pending.baselineCost).toBeCloseTo(9.174, 3);
    expect(pending.savingsDollars).toBeCloseTo(9.174 - 8.118, 3);
    expect(pending.savingsGallons).toBeCloseTo((27.8 - 24.6) / 24, 6);
  });

  test('a route that costs more than the baseline records a negative saving', async () => {
    // Make Efficient pricier than Fastest by giving it far more miles, then choose it.
    setup({
      routes: { optimized: option('fuel_efficient', 40, 41, POLY_A), standard: option('standard', 27.8, 29, POLY_B) },
    });
    await renderScreen(<RouteCompareScreen />);
    await select('Efficient');
    await fireEvent.press(screen.getByRole('button', { name: 'Open in Maps' }));

    await waitFor(() => expect(useTripStore.getState().pendingTrip).not.toBeNull());
    expect(useTripStore.getState().pendingTrip!.savingsDollars).toBeLessThan(0);
  });

  test('launches Google Maps with the route, then goes to the confirm screen', async () => {
    setup();
    await renderScreen(<RouteCompareScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Open in Maps' }));

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/trip-summary'));
    expect(launch).toHaveBeenCalledWith(
      'google',
      expect.objectContaining({ origin: ORIGIN, destination: DEST, waypoints: expect.any(Array) }),
    );
  });

  test('the pending trip is saved before the maps app opens', async () => {
    setup();
    let pendingAtLaunch: unknown = 'not called';
    launch.mockImplementationOnce(async () => {
      pendingAtLaunch = useTripStore.getState().pendingTrip;
    });
    await renderScreen(<RouteCompareScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Open in Maps' }));

    await waitFor(() => expect(launch).toHaveBeenCalled());
    expect(pendingAtLaunch).not.toBeNull(); // on web the page may navigate away the moment it opens
  });

  test('the alternative apps launch with their own app id', async () => {
    setup();
    await renderScreen(<RouteCompareScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Use Waze instead' }));

    await waitFor(() => expect(launch).toHaveBeenCalledWith('waze', expect.objectContaining({ destination: DEST })));
  });
});

describe('fuel price', () => {
  test('a custom price on the vehicle is used and no warning is shown', async () => {
    setup();
    await renderScreen(<RouteCompareScreen />);
    expect(screen.queryByText(/Live fuel prices are unavailable/)).toBeNull();
  });

  test('without live pricing or an override, warns that an estimate is in use', async () => {
    setup({ vehicle: { ...CAMRY, gasPriceOverride: null } });
    await renderScreen(<RouteCompareScreen />);
    expect(screen.getByText(/Live fuel prices are unavailable\. Using an estimate of/)).toBeTruthy();
    expect(screen.getByText('$3.49/gal')).toBeTruthy();
  });
});

describe('loading and errors', () => {
  test('shows a skeleton while routes are being found', async () => {
    setup();
    compute.mockReturnValue(new Promise(() => {})); // never resolves
    await renderScreen(<RouteCompareScreen />, { settle: false });

    expect(await screen.findByText('Finding the best routes…')).toBeTruthy();
    expect(screen.getByText(/Checking traffic and fuel prices on the way to Target/)).toBeTruthy();
  });

  test('a routing failure offers retry and a way to navigate anyway', async () => {
    setup();
    compute.mockRejectedValue(new Error('routing down'));
    await renderScreen(<RouteCompareScreen />, { settle: false });

    expect(await screen.findByText("We couldn't calculate routes", {}, ERROR_WAIT)).toBeTruthy();
    expect(screen.getByText("The routing service isn't responding. Your origin and destination are saved.")).toBeTruthy();
  });

  test('"Try again" asks for the routes again', async () => {
    setup();
    // Persistent, not "once": the query runs again when the vehicle loads (its key includes MPG and price).
    compute.mockRejectedValue(new Error('routing down'));
    await renderScreen(<RouteCompareScreen />, { settle: false });
    await screen.findByText("We couldn't calculate routes", {}, ERROR_WAIT);

    compute.mockResolvedValue(TWO_ROUTES);
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Compare routes')).toBeTruthy();
  });

  test('"Open in Maps without comparing" launches straight to the destination', async () => {
    setup();
    compute.mockRejectedValue(new Error('routing down'));
    await renderScreen(<RouteCompareScreen />, { settle: false });
    await fireEvent.press(await screen.findByRole('button', { name: 'Open in Maps without comparing' }, ERROR_WAIT));

    expect(launch).toHaveBeenCalledWith('google', { origin: ORIGIN, destination: DEST });
    expect(useTripStore.getState().pendingTrip).toBeNull(); // nothing to confirm: no route was chosen
  });

  test('with no trip planned, sends the user to plan one', async () => {
    setup();
    useTripStore.setState({ lastRouteQuery: null });
    await renderScreen(<RouteCompareScreen />, { settle: false });

    expect(screen.getByText('No trip planned yet')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Plan a trip' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/routes');
  });
});

describe('navigation', () => {
  test('the vehicle and preference chips open Garage and Route preferences', async () => {
    setup();
    await renderScreen(<RouteCompareScreen />);

    await fireEvent.press(screen.getByText(/Toyota Camry LE\/SE/));
    expect(mockRouter.push).toHaveBeenCalledWith('/garage');
    await fireEvent.press(screen.getByText('$18/hr'));
    expect(mockRouter.push).toHaveBeenCalledWith('/route-preferences');
  });

  test('the back button returns to search', async () => {
    mockRouter.canGoBack.mockReturnValue(false);
    setup();
    await renderScreen(<RouteCompareScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/routes');
  });
});
