import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { RoutePreferencesScreen } from '@/features/profile/RoutePreferencesScreen';
import type { RoutePreferences } from '@/schemas/route-preferences';

import { ApiError, mockApi, type ApiCall } from '../helpers/api';
import { CAMRY } from '../helpers/fixtures';
import { mockRouter, renderScreen, resetAppState } from '../helpers/render';

const PREFS: RoutePreferences = { priority: 'balance', timeValuePerHour: 18, includeTolls: true };

function server(opts: { vehicle?: unknown; prefs?: RoutePreferences; extra?: Record<string, unknown> } = {}) {
  return mockApi({
    'GET /api/route-preferences': opts.prefs ?? PREFS,
    'PUT /api/route-preferences': ({ body }: ApiCall) => body,
    'GET /api/vehicle-profile': opts.vehicle === undefined ? CAMRY : opts.vehicle,
    'PUT /api/vehicle-profile': ({ body }: ApiCall) => body,
    ...opts.extra,
  });
}

const save = () => fireEvent.press(screen.getByRole('button', { name: 'Save preferences' }));
const priority = (name: string) => screen.getByRole('radio', { name });

beforeEach(resetAppState);

describe('loading', () => {
  test('shows the saved priority', async () => {
    server({ prefs: { ...PREFS, priority: 'fast' } });
    await renderScreen(<RoutePreferencesScreen />);

    expect(priority('Fastest')).toBeChecked();
    expect(priority('Balance')).not.toBeChecked();
    expect(priority('Lowest cost')).not.toBeChecked();
  });

  test('explains what the chosen priority does', async () => {
    server();
    await renderScreen(<RoutePreferencesScreen />);
    expect(screen.getByText(/Weighs money against time using your time value/)).toBeTruthy();

    await fireEvent.press(priority('Lowest cost'));
    expect(screen.getByText(/Always recommends the route with the lowest estimated trip cost/)).toBeTruthy();
  });

  test("starts from the active vehicle's depreciation, not a global value", async () => {
    server({ vehicle: { ...CAMRY, depreciationPerMile: 0.31 } });
    await renderScreen(<RoutePreferencesScreen />);
    expect(screen.getByLabelText('Depreciation per mile').props.value).toBe('0.31');
  });

  test('shows the time-value rule as dollars for 4 extra minutes', async () => {
    server();
    await renderScreen(<RoutePreferencesScreen />);
    expect(screen.getByText('$1.20')).toBeTruthy(); // 4 ÷ 60 × $18
  });
});

describe('the live preview', () => {
  const preview = () => screen.getByText('On a typical trip, these settings pick');

  test('follows the priority', async () => {
    server();
    await renderScreen(<RoutePreferencesScreen />);
    expect(preview()).toBeTruthy();
    expect(screen.getAllByText('Balanced').length).toBeGreaterThan(0);

    await fireEvent.press(priority('Lowest cost'));
    expect(screen.getAllByText('Cheapest').length).toBeGreaterThan(0);

    await fireEvent.press(priority('Fastest'));
    expect(screen.getAllByText('Fastest').length).toBeGreaterThan(0);
  });

  test('reprices with the vehicle depreciation as it is edited', async () => {
    server();
    await renderScreen(<RoutePreferencesScreen />);
    const before = screen.getByText(/· 33 min$/).props.children.join('');

    await fireEvent.changeText(screen.getByLabelText('Depreciation per mile'), '0.50');
    const after = screen.getByText(/· 33 min$/).props.children.join('');
    expect(after).not.toBe(before);
  });
});

describe('saving', () => {
  test('writes the priority, time value and tolls — and no longer depreciation', async () => {
    const api = server();
    await renderScreen(<RoutePreferencesScreen />);
    await fireEvent.press(priority('Fastest'));
    await save();

    await waitFor(() => expect(api.callsTo('PUT /api/route-preferences')).toHaveLength(1));
    expect(api.callsTo('PUT /api/route-preferences')[0].body).toEqual({
      priority: 'fast',
      timeValuePerHour: 18,
      includeTolls: true,
    });
  });

  test('leaves the vehicle alone when only preferences changed', async () => {
    const api = server();
    await renderScreen(<RoutePreferencesScreen />);
    await fireEvent.press(priority('Lowest cost'));
    await save();

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(api.callsTo('PUT /api/vehicle-profile')).toHaveLength(0);
  });

  test("saves a new depreciation onto the active vehicle, keeping its other fields", async () => {
    const api = server();
    await renderScreen(<RoutePreferencesScreen />);
    await fireEvent.changeText(screen.getByLabelText('Depreciation per mile'), '0.25');
    await save();

    await waitFor(() => expect(api.callsTo('PUT /api/vehicle-profile')).toHaveLength(1));
    expect(api.callsTo('PUT /api/vehicle-profile')[0].body).toMatchObject({
      year: '2024',
      makeModel: 'Toyota Camry LE/SE',
      mpg: 24,
      depreciationPerMile: 0.25,
    });
  });

  test('a fuel-price override is saved on the vehicle', async () => {
    const api = server({ vehicle: { ...CAMRY, gasPriceOverride: null } });
    await renderScreen(<RoutePreferencesScreen />);
    await fireEvent(screen.getByLabelText('Override fuel price'), 'valueChange', true);
    await fireEvent.changeText(screen.getByLabelText('Fuel price per gallon'), '4.10');
    await save();

    await waitFor(() => expect(api.callsTo('PUT /api/vehicle-profile')).toHaveLength(1));
    expect(api.callsTo('PUT /api/vehicle-profile')[0].body).toMatchObject({ gasPriceOverride: 4.1 });
  });

  test('turning the override off clears it', async () => {
    const api = server({ vehicle: { ...CAMRY, gasPriceOverride: 3.6 } });
    await renderScreen(<RoutePreferencesScreen />);
    await fireEvent(screen.getByLabelText('Override fuel price'), 'valueChange', false);
    await save();

    await waitFor(() => expect(api.callsTo('PUT /api/vehicle-profile')).toHaveLength(1));
    expect(api.callsTo('PUT /api/vehicle-profile')[0].body).toMatchObject({ gasPriceOverride: null });
  });

  test.each(['-1', '6', 'abc', ''])('a depreciation of %p is rejected without saving', async (value) => {
    const api = server();
    await renderScreen(<RoutePreferencesScreen />);
    await fireEvent.changeText(screen.getByLabelText('Depreciation per mile'), value);
    await save();

    expect(await screen.findByText('Depreciation must be between $0.00 and $5.00 per mile.')).toBeTruthy();
    expect(api.callsTo('PUT')).toHaveLength(0);
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  test('an override of $0 is rejected', async () => {
    const api = server({ vehicle: { ...CAMRY, gasPriceOverride: null } });
    await renderScreen(<RoutePreferencesScreen />);
    await fireEvent(screen.getByLabelText('Override fuel price'), 'valueChange', true);
    await fireEvent.changeText(screen.getByLabelText('Fuel price per gallon'), '0');
    await save();

    expect(await screen.findByText(/Enter a fuel price greater than \$0/)).toBeTruthy();
    expect(api.callsTo('PUT')).toHaveLength(0);
  });

  test('a failed save keeps the user on the screen with an error', async () => {
    server({ extra: { 'PUT /api/route-preferences': new ApiError(500) } });
    await renderScreen(<RoutePreferencesScreen />);
    await save();

    expect(await screen.findByText("Couldn't save your preferences. Check your connection and try again.")).toBeTruthy();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  test('opened by URL (no history), saving goes to Profile instead of failing', async () => {
    mockRouter.canGoBack.mockReturnValue(false);
    server();
    await renderScreen(<RoutePreferencesScreen />);
    await save();

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/profile'));
    expect(mockRouter.back).not.toHaveBeenCalled();
  });
});

describe('when the saved preferences cannot be loaded', () => {
  test('shows an error with a retry instead of the form or an endless loader', async () => {
    server({ extra: { 'GET /api/route-preferences': new ApiError(500) } });
    await renderScreen(<RoutePreferencesScreen />);

    expect(await screen.findByText("Couldn't load your preferences")).toBeTruthy();
    expect(screen.getByText(/Your saved settings haven't changed/)).toBeTruthy();
    expect(screen.queryByText('Loading preferences…')).toBeNull();
    // Showing defaults as if they were the user's would let a save overwrite their real settings.
    expect(screen.queryByRole('button', { name: 'Save preferences' })).toBeNull();
  });

  test('"Try again" loads the form once the request succeeds', async () => {
    let healthy = false;
    server({ extra: { 'GET /api/route-preferences': () => (healthy ? PREFS : new ApiError(500)) } });
    await renderScreen(<RoutePreferencesScreen />);
    await screen.findByText("Couldn't load your preferences");

    healthy = true;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Save preferences' })).toBeTruthy();
  });
});

describe('without a vehicle', () => {
  test('hides the settings that belong to a vehicle', async () => {
    server({ vehicle: null });
    await renderScreen(<RoutePreferencesScreen />);

    expect(screen.queryByLabelText('Depreciation per mile')).toBeNull();
    expect(screen.queryByLabelText('Override fuel price')).toBeNull();
    expect(screen.getByLabelText('Include tolls in trip cost')).toBeTruthy();
  });

  test('can still save the routing preferences', async () => {
    const api = server({ vehicle: null });
    await renderScreen(<RoutePreferencesScreen />);
    await fireEvent.press(priority('Fastest'));
    await save();

    await waitFor(() => expect(api.callsTo('PUT /api/route-preferences')).toHaveLength(1));
    expect(api.callsTo('PUT /api/vehicle-profile')).toHaveLength(0);
  });
});
