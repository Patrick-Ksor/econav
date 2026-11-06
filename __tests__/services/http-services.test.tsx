import { act, waitFor } from '@testing-library/react-native';

import { DEFAULT_ROUTE_PREFERENCES } from '@/schemas/route-preferences';
import { useActivateVehicle, useAddVehicle, useDeleteVehicle, useGarageVehicles } from '@/services/garage';
import { useRoutePreferences, useSaveRoutePreferences } from '@/services/route-preferences';
import { useAddTrip, useDeleteTrip, useTrips, useTripsSummary } from '@/services/trips';
import { useSaveVehicleProfile, useVehicleProfile } from '@/services/vehicle-profile';

import { ApiError, mockApi } from '../helpers/api';
import { CAMRY, CIVIC, trip } from '../helpers/fixtures';
import { renderQueryHook, resetAppState } from '../helpers/render';

const clerk = jest.requireMock('@clerk/expo') as { __auth: { signedIn: boolean; token: string | null } };

const SUMMARY = { tripCount: 3, totalSavingsDollars: 12.5, totalSavingsGallons: 1.2, monthSavingsDollars: 4 };
const PREFS = { priority: 'fast', timeValuePerHour: 30, includeTolls: false };
const { isActive: _a, id: _i, ...CAMRY_PROFILE } = CAMRY;

beforeEach(resetAppState);

describe('authentication', () => {
  test('requests carry the session token as a Bearer header', async () => {
    const api = mockApi({ 'GET /api/trips': [trip()] });
    const { result } = await renderQueryHook(() => useTrips());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.callsTo('GET /api/trips')[0].headers).toEqual({ Authorization: 'Bearer test-token' });
  });

  test('without a token, no Authorization header is sent', async () => {
    clerk.__auth.token = null;
    const api = mockApi({ 'GET /api/trips': [] });
    const { result } = await renderQueryHook(() => useTrips());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.callsTo('GET /api/trips')[0].headers.Authorization).toBeUndefined();
  });

  test.each<[string, () => { fetchStatus: string }]>([
    ['trips', () => useTrips()],
    ['the trips summary', () => useTripsSummary()],
    ['the active vehicle', () => useVehicleProfile()],
    ['route preferences', () => useRoutePreferences()],
    ['the garage', () => useGarageVehicles()],
  ])('signed out, %s is not requested at all', async (_name, hook) => {
    clerk.__auth.signedIn = false;
    const api = mockApi({});
    const { result } = await renderQueryHook(hook);

    expect(result.current.fetchStatus).toBe('idle');
    expect(api.all).toHaveLength(0);
  });
});

describe('trips', () => {
  test('loads and validates the trip list', async () => {
    mockApi({ 'GET /api/trips': [trip({ id: 'a' }), trip({ id: 'b', savingsDollars: null })] });
    const { result } = await renderQueryHook(() => useTrips());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((t) => t.id)).toEqual(['a', 'b']);
  });

  test('a server error becomes a query error with the status', async () => {
    mockApi({ 'GET /api/trips': new ApiError(500) });
    const { result } = await renderQueryHook(() => useTrips());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Failed to load trips: 500');
  });

  test('a malformed trip is rejected rather than shown', async () => {
    mockApi({ 'GET /api/trips': [{ id: 'a' }] });
    const { result } = await renderQueryHook(() => useTrips());
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  test('loads the lifetime summary', async () => {
    mockApi({ 'GET /api/trips/summary': SUMMARY });
    const { result } = await renderQueryHook(() => useTripsSummary());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(SUMMARY);
  });

  test('a summary error carries the status', async () => {
    mockApi({ 'GET /api/trips/summary': new ApiError(503) });
    const { result } = await renderQueryHook(() => useTripsSummary());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Failed to load trips summary: 503');
  });

  describe('changing trips refreshes both the list and the totals', () => {
    const setup = async () => {
      const api = mockApi({
        'GET /api/trips': [trip()],
        'GET /api/trips/summary': SUMMARY,
        'POST /api/trips': ({ body }: { body: unknown }) => body,
        'DELETE /api/trips/*': null,
      });
      const hook = await renderQueryHook(() => ({ trips: useTrips(), summary: useTripsSummary(), add: useAddTrip(), del: useDeleteTrip() }));
      await waitFor(() => expect(hook.result.current.trips.isSuccess && hook.result.current.summary.isSuccess).toBe(true));
      return { api, ...hook };
    };

    test('adding a trip posts it and refetches', async () => {
      const { api, result } = await setup();
      await act(async () => {
        await result.current.add.mutateAsync(trip({ id: 'new', destinationLabel: 'Harbor View' }));
      });

      expect(api.callsTo('POST /api/trips')[0].body).toMatchObject({ id: 'new', destinationLabel: 'Harbor View' });
      const gets = (path: string) => api.calls.filter((c) => c.method === 'GET' && c.path === path);
      await waitFor(() => expect(gets('/api/trips')).toHaveLength(2)); // list refetched
      await waitFor(() => expect(gets('/api/trips/summary')).toHaveLength(2)); // so were the totals
    });

    test('a failed save rejects with the status', async () => {
      const { result } = await setup();
      mockApi({ 'POST /api/trips': new ApiError(500) });
      await act(async () => {
        await expect(result.current.add.mutateAsync(trip())).rejects.toThrow('Failed to save trip: 500');
      });
    });

    test('deleting a trip refetches, and encodes the id in the URL', async () => {
      const { api, result } = await setup();
      await act(async () => {
        await result.current.del.mutateAsync('a b/c');
      });

      expect(api.callsTo('DELETE')[0].path).toBe('/api/trips/a%20b%2Fc');
      await waitFor(() => expect(api.callsTo('GET /api/trips/summary')).toHaveLength(2));
    });

    test('a failed delete rejects with the status', async () => {
      const { result } = await setup();
      mockApi({ 'DELETE /api/trips/*': new ApiError(404) });
      await act(async () => {
        await expect(result.current.del.mutateAsync('x')).rejects.toThrow('Failed to delete trip: 404');
      });
    });
  });
});

describe('the active vehicle', () => {
  test('loads it', async () => {
    mockApi({ 'GET /api/vehicle-profile': CAMRY });
    const { result } = await renderQueryHook(() => useVehicleProfile());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ makeModel: 'Toyota Camry LE/SE', mpg: 24, depreciationPerMile: 0.18 });
  });

  test('no vehicle is null, not an error', async () => {
    mockApi({ 'GET /api/vehicle-profile': null });
    const { result } = await renderQueryHook(() => useVehicleProfile());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  test('a vehicle without depreciation gets the $0.18 default', async () => {
    const { depreciationPerMile: _d, ...legacy } = CAMRY;
    mockApi({ 'GET /api/vehicle-profile': legacy });
    const { result } = await renderQueryHook(() => useVehicleProfile());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.depreciationPerMile).toBe(0.18);
  });

  test('a server error carries the status', async () => {
    mockApi({ 'GET /api/vehicle-profile': new ApiError(500) });
    const { result } = await renderQueryHook(() => useVehicleProfile());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Failed to load vehicle profile: 500');
  });

  test('saving PUTs the profile and updates the cache without a refetch', async () => {
    const api = mockApi({
      'GET /api/vehicle-profile': CAMRY,
      'PUT /api/vehicle-profile': ({ body }: { body: unknown }) => body,
    });
    const { result } = await renderQueryHook(() => ({ vehicle: useVehicleProfile(), save: useSaveVehicleProfile() }));
    await waitFor(() => expect(result.current.vehicle.isSuccess).toBe(true));

    await act(async () => {
      await result.current.save.mutateAsync({ ...CAMRY_PROFILE, mpg: 31, updatedAt: '2026-11-06T00:00:00.000Z' });
    });

    expect(api.callsTo('PUT /api/vehicle-profile')[0].body).toMatchObject({ mpg: 31 });
    await waitFor(() => expect(result.current.vehicle.data?.mpg).toBe(31));
    expect(api.callsTo('GET /api/vehicle-profile')).toHaveLength(1); // cache set directly
  });

  test('a failed save rejects with the status', async () => {
    mockApi({ 'PUT /api/vehicle-profile': new ApiError(500) });
    const { result } = await renderQueryHook(() => useSaveVehicleProfile());
    await act(async () => {
      await expect(result.current.mutateAsync({ ...CAMRY_PROFILE })).rejects.toThrow('Failed to save vehicle profile: 500');
    });
  });
});

describe('route preferences', () => {
  test('shows the defaults immediately, before anything loads', async () => {
    mockApi({ 'GET /api/route-preferences': new Promise(() => {}) as never });
    const { result } = await renderQueryHook(() => useRoutePreferences());
    expect(result.current.data).toEqual(DEFAULT_ROUTE_PREFERENCES);
    expect(result.current.isPlaceholderData).toBe(true);
  });

  test('then replaces them with the saved values', async () => {
    mockApi({ 'GET /api/route-preferences': PREFS });
    const { result } = await renderQueryHook(() => useRoutePreferences());
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
    expect(result.current.data).toEqual(PREFS);
  });

  test('a load error keeps the defaults, so screens that only read them keep working', async () => {
    mockApi({ 'GET /api/route-preferences': new ApiError(500) });
    const { result } = await renderQueryHook(() => useRoutePreferences());
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Failed to load route preferences: 500');
    expect(result.current.data).toEqual(DEFAULT_ROUTE_PREFERENCES); // never undefined
    expect(result.current.isPlaceholderData).toBe(true); // …but flagged as not the user's own
  });

  test('saving PUTs and updates the cache', async () => {
    const api = mockApi({
      'GET /api/route-preferences': DEFAULT_ROUTE_PREFERENCES,
      'PUT /api/route-preferences': ({ body }: { body: unknown }) => body,
    });
    const { result } = await renderQueryHook(() => ({ prefs: useRoutePreferences(), save: useSaveRoutePreferences() }));
    await waitFor(() => expect(result.current.prefs.isPlaceholderData).toBe(false));

    await act(async () => {
      await result.current.save.mutateAsync(PREFS as never);
    });
    expect(api.callsTo('PUT /api/route-preferences')[0].body).toEqual(PREFS);
    await waitFor(() => expect(result.current.prefs.data).toEqual(PREFS));
  });

  test('a failed save rejects with the status', async () => {
    mockApi({ 'PUT /api/route-preferences': new ApiError(500) });
    const { result } = await renderQueryHook(() => useSaveRoutePreferences());
    await act(async () => {
      await expect(result.current.mutateAsync(DEFAULT_ROUTE_PREFERENCES)).rejects.toThrow(
        'Failed to save route preferences: 500',
      );
    });
  });
});

describe('the garage', () => {
  const setup = async (extra: Record<string, unknown> = {}) => {
    const api = mockApi({
      'GET /api/vehicles': [CAMRY, CIVIC],
      'GET /api/vehicle-profile': CAMRY,
      'POST /api/vehicles': null,
      'PATCH /api/vehicles/*': null,
      'DELETE /api/vehicles/*': null,
      ...extra,
    });
    const hook = await renderQueryHook(() => ({
      garage: useGarageVehicles(),
      active: useVehicleProfile(),
      add: useAddVehicle(),
      use: useActivateVehicle(),
      del: useDeleteVehicle(),
    }));
    await waitFor(() => expect(hook.result.current.garage.isSuccess && hook.result.current.active.isSuccess).toBe(true));
    return { api, ...hook };
  };

  test('lists every vehicle with its active flag', async () => {
    const { result } = await setup();
    expect(result.current.garage.data?.map((v) => [v.id, v.isActive])).toEqual([
      ['veh_camry', true],
      ['veh_civic', false],
    ]);
  });

  test('a garage load error carries the status', async () => {
    mockApi({ 'GET /api/vehicles': new ApiError(500) });
    const { result } = await renderQueryHook(() => useGarageVehicles());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Failed to load vehicles: 500');
  });

  test('adding posts the vehicle, then refreshes both the garage and the active vehicle', async () => {
    const { api, result } = await setup();
    await act(async () => {
      await result.current.add.mutateAsync({ ...CAMRY_PROFILE, id: 'veh_new', makeModel: 'Mazda 3' } as never);
    });

    expect(api.callsTo('POST /api/vehicles')[0].body).toMatchObject({ id: 'veh_new', makeModel: 'Mazda 3' });
    await waitFor(() => expect(api.callsTo('GET /api/vehicles')).toHaveLength(2));
    await waitFor(() => expect(api.callsTo('GET /api/vehicle-profile')).toHaveLength(2));
  });

  test('switching PATCHes that vehicle and refreshes both', async () => {
    const { api, result } = await setup();
    await act(async () => {
      await result.current.use.mutateAsync('veh_civic');
    });

    expect(api.callsTo('PATCH /api/vehicles/veh_civic')).toHaveLength(1);
    await waitFor(() => expect(api.callsTo('GET /api/vehicle-profile')).toHaveLength(2));
  });

  test('removing DELETEs that vehicle and refreshes both', async () => {
    const { api, result } = await setup();
    await act(async () => {
      await result.current.del.mutateAsync('veh_civic');
    });

    expect(api.callsTo('DELETE /api/vehicles/veh_civic')).toHaveLength(1);
    await waitFor(() => expect(api.callsTo('GET /api/vehicles')).toHaveLength(2));
  });

  test('ids are URL-encoded', async () => {
    const { api, result } = await setup();
    await act(async () => {
      await result.current.use.mutateAsync('a b');
    });
    expect(api.callsTo('PATCH')[0].path).toBe('/api/vehicles/a%20b');
  });

  test.each([
    ['add', 'POST /api/vehicles', 'Failed to add vehicle: 500'],
    ['use', 'PATCH /api/vehicles/*', 'Failed to switch vehicle: 500'],
    ['del', 'DELETE /api/vehicles/*', 'Failed to remove vehicle: 500'],
  ] as const)('a failed %s rejects with the status', async (which, route, message) => {
    const { result } = await setup({ [route]: new ApiError(500) });
    await act(async () => {
      const call =
        which === 'add'
          ? result.current.add.mutateAsync({ ...CAMRY_PROFILE, id: 'x' } as never)
          : which === 'use'
            ? result.current.use.mutateAsync('x')
            : result.current.del.mutateAsync('x');
      await expect(call).rejects.toThrow(message);
    });
  });
});
