import { waitFor } from '@testing-library/react-native';

import {
  fetchVehicleFuelDataRaw,
  fetchVehicleMakesRaw,
  fetchVehicleModelsRaw,
  fetchVehicleTrimsRaw,
  fetchVehicleYearsRaw,
  useVehicleMakes,
  useVehicleModels,
  useVehicleTrims,
  useVehicleYears,
} from '@/services/fuel-economy';

import { ApiError, RawBody, mockApi } from '../helpers/api';
import { epaRoutes, menu, record } from '../helpers/epa';
import { renderQueryHook } from '../helpers/render';

describe('menus', () => {
  test('years come from the value of each item', async () => {
    mockApi(epaRoutes());
    expect(await fetchVehicleYearsRaw()).toEqual(['2022', '2021', '2020']);
  });

  test('makes are requested for the year', async () => {
    const api = mockApi(epaRoutes());
    expect(await fetchVehicleMakesRaw('2021')).toEqual(['Honda', 'Toyota', 'Ford']);
    expect(api.urlsTo('https://www.fueleconomy.gov/ws/rest/vehicle/menu/make')[0].searchParams.get('year')).toBe('2021');
  });

  test('models are requested for the year and make', async () => {
    const api = mockApi(epaRoutes());
    expect(await fetchVehicleModelsRaw('2021', 'Toyota')).toEqual(['RAV4', 'Camry']);
    const url = api.urlsTo('https://www.fueleconomy.gov/ws/rest/vehicle/menu/model')[0];
    expect(url.searchParams.get('year')).toBe('2021');
    expect(url.searchParams.get('make')).toBe('Toyota');
  });

  test('trims keep their label (text) and id (value)', async () => {
    mockApi(epaRoutes());
    const trims = await fetchVehicleTrimsRaw('2021', 'Toyota', 'RAV4');
    expect(trims[0]).toEqual({ id: '46123', label: 'Auto (S8), 4cyl, 2.5 L' });
    expect(trims).toHaveLength(4);
  });

  test('names with spaces and symbols are URL-encoded', async () => {
    const api = mockApi({ 'GET /ws/rest/vehicle/menu/options': menu([]) });
    await fetchVehicleTrimsRaw('2021', 'Land Rover', 'Range Rover & Sport');

    const url = api.urlsTo('https://www.fueleconomy.gov/ws/rest/vehicle/menu/options')[0];
    expect(url.searchParams.get('make')).toBe('Land Rover');
    expect(url.searchParams.get('model')).toBe('Range Rover & Sport');
  });

  test('XML entities in names are decoded', async () => {
    mockApi({
      'GET /ws/rest/vehicle/menu/make': menu([['Mercedes-Benz &amp; AMG', 'Mercedes-Benz &amp; AMG'], ['A &lt; B &gt; C', 'x'], ['&quot;Q&quot; &apos;s', 'y']]),
    });
    expect(await fetchVehicleMakesRaw('2021')).toEqual(['Mercedes-Benz & AMG', 'x', 'y']);
  });

  test('an empty menu is an empty list', async () => {
    mockApi({ 'GET /ws/rest/vehicle/menu/year': new RawBody('<menuItems></menuItems>') });
    expect(await fetchVehicleYearsRaw()).toEqual([]);
  });

  test('a failed request throws with the status', async () => {
    mockApi({ 'GET /ws/rest/vehicle/menu/year': new ApiError(503) });
    await expect(fetchVehicleYearsRaw()).rejects.toThrow('fueleconomy.gov request failed: 503');
  });
});

describe('fetchVehicleFuelDataRaw', () => {
  const lookup = async (xml: RawBody) => {
    mockApi({ 'GET /ws/rest/vehicle/*': xml });
    return fetchVehicleFuelDataRaw('123');
  };

  test('reads combined MPG for a gasoline car', async () => {
    expect(await lookup(record(30))).toEqual({ mpg: 30, fuelGrade: 'regular', isElectric: false });
  });

  test.each([
    ['Regular Gasoline', 'regular'],
    ['Midgrade Gasoline', 'regular'],
    ['Premium Gasoline', 'premium'],
    ['Diesel', 'diesel'],
    ['Gasoline or E85', 'regular'],
    ['Something New', 'regular'],
  ])('fuel type "%s" is %s', async (epaType, grade) => {
    expect((await lookup(record(25, epaType))).fuelGrade).toBe(grade);
  });

  test('is case-insensitive about the fuel type', async () => {
    expect((await lookup(record(25, 'PREMIUM GASOLINE'))).fuelGrade).toBe('premium');
  });

  test('an electric car has no usable MPG (its figure is MPGe)', async () => {
    expect(await lookup(record(112, 'Electricity', 'EV'))).toEqual({ mpg: null, fuelGrade: 'regular', isElectric: true });
  });

  test('electricity as the fuel marks it electric even without an EV type', async () => {
    expect((await lookup(record(100, 'Electricity'))).isElectric).toBe(true);
  });

  test('a plug-in hybrid still burns gasoline, so it keeps its MPG', async () => {
    expect(await lookup(record(48, 'Premium Gasoline', 'Plug-in Hybrid'))).toEqual({
      mpg: 48,
      fuelGrade: 'premium',
      isElectric: false,
    });
  });

  test.each([['0'], ['-5'], ['abc'], ['']])('a combined MPG of %p is treated as no data', async (mpg) => {
    expect(await lookup(record(mpg))).toMatchObject({ mpg: null, isElectric: false });
  });

  test('a record with no MPG tag at all is treated as no data', async () => {
    expect(await lookup(new RawBody('<vehicle><fuelType1>Regular Gasoline</fuelType1></vehicle>'))).toMatchObject({
      mpg: null,
    });
  });

  test('a failed request throws with the status', async () => {
    mockApi({ 'GET /ws/rest/vehicle/*': new ApiError(404) });
    await expect(fetchVehicleFuelDataRaw('123')).rejects.toThrow('fueleconomy.gov vehicle lookup failed: 404');
  });

  test('requests the record by its id', async () => {
    const api = mockApi({ 'GET /ws/rest/vehicle/*': record(30) });
    await fetchVehicleFuelDataRaw('46123');
    expect(api.all[0].url).toBe('https://www.fueleconomy.gov/ws/rest/vehicle/46123');
  });
});

describe('the lookup hooks only ask for what they can ask for', () => {
  test('years load immediately', async () => {
    mockApi(epaRoutes());
    const { result } = await renderQueryHook(() => useVehicleYears());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(['2022', '2021', '2020']);
  });

  test('makes wait for a year', async () => {
    const api = mockApi(epaRoutes());
    const sel = { year: null as string | null };
    const { result, rerender } = await renderQueryHook(() => useVehicleMakes(sel.year));
    expect(result.current.fetchStatus).toBe('idle');
    expect(api.all).toHaveLength(0);

    sel.year = '2021';
    await rerender(undefined);
    await waitFor(() => expect(result.current.data).toEqual(['Honda', 'Toyota', 'Ford']));
  });

  test('models wait for a year and a make', async () => {
    const api = mockApi(epaRoutes());
    const sel = { year: '2021' as string | null, make: null as string | null };
    const { result, rerender } = await renderQueryHook(() => useVehicleModels(sel.year, sel.make));
    expect(api.all).toHaveLength(0); // a year alone is not enough

    sel.make = 'Toyota';
    await rerender(undefined);
    await waitFor(() => expect(result.current.data).toEqual(['RAV4', 'Camry']));
  });

  test('trims wait for a year, make and model', async () => {
    const api = mockApi(epaRoutes());
    const sel = { year: '2021', make: 'Toyota', model: null as string | null };
    const { result, rerender } = await renderQueryHook(() => useVehicleTrims(sel.year, sel.make, sel.model));
    expect(api.all).toHaveLength(0);

    sel.model = 'RAV4';
    await rerender(undefined);
    await waitFor(() => expect(result.current.data).toHaveLength(4));
  });

  test('a lookup error surfaces as a query error', async () => {
    mockApi({ 'GET /ws/rest/vehicle/menu/year': new ApiError(500) });
    const { result } = await renderQueryHook(() => useVehicleYears());
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
