import { waitFor } from '@testing-library/react-native';

import { useGasPrice } from '@/services/gas-price';

import { mockApi, type ApiCall } from '../helpers/api';
import { loadFresh } from '../helpers/load';
import { renderQueryHook } from '../helpers/render';

type GasPrice = typeof import('@/services/gas-price');

const KEYS = { EXPO_PUBLIC_EIA_API_KEY: 'eia-key', EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: 'pk.test' };
const withKeys = () => loadFresh<GasPrice>(() => require('@/services/gas-price'), KEYS);
const withoutKeys = () =>
  loadFresh<GasPrice>(() => require('@/services/gas-price'), {
    EXPO_PUBLIC_EIA_API_KEY: undefined,
    EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: undefined,
  });

const REVERSE = 'GET /search/geocode/v6/reverse';
const EIA = 'GET /v2/petroleum/pri/gnd/data/';
const CHARLOTTE = { lat: 35.15, lng: -80.93 };

const state = (code: string | null) =>
  code ? { features: [{ properties: { context: { region: { region_code: code, region_code_full: `US-${code}` } } } }] } : { features: [] };
const eia = (value: string | number | null) => ({ response: { data: value === null ? [] : [{ value }] } });

/** The EIA request's facets, read from its URL. */
const facets = (c: ApiCall) => {
  const u = new URL(c.url);
  return { area: u.searchParams.get('facets[duoarea][]'), product: u.searchParams.get('facets[product][]'), u };
};

describe('with no EIA key', () => {
  test.each([
    ['regular', 3.49],
    ['premium', 4.19],
    ['diesel', 3.99],
  ] as const)('%s uses the fixed %p estimate, marked as a stub', async (grade, price) => {
    const api = mockApi({});
    const result = await withoutKeys().fetchGasPriceRaw(grade);

    expect(result).toMatchObject({ pricePerGallon: price, source: 'stub' });
    expect(api.all).toHaveLength(0); // never calls out without a key
  });
});

describe('with an EIA key', () => {
  test('asks for the latest weekly price of the right fuel', async () => {
    const api = mockApi({ [EIA]: eia('3.456') });
    await withKeys().fetchGasPriceRaw('premium');

    const { u, product } = facets(api.all[0]);
    expect(u.searchParams.get('api_key')).toBe('eia-key');
    expect(u.searchParams.get('frequency')).toBe('weekly');
    expect(u.searchParams.get('sort[0][column]')).toBe('period');
    expect(u.searchParams.get('sort[0][direction]')).toBe('desc');
    expect(u.searchParams.get('length')).toBe('1');
    expect(product).toBe('EPMP');
  });

  test.each([
    ['regular', 'EPMR'],
    ['premium', 'EPMP'],
    ['diesel', 'EPD2D'],
  ] as const)('%s maps to EIA product %s', async (grade, code) => {
    const api = mockApi({ [EIA]: eia('3.5') });
    await withKeys().fetchGasPriceRaw(grade);
    expect(facets(api.all[0]).product).toBe(code);
  });

  test('returns the price as a number, from the API', async () => {
    mockApi({ [EIA]: eia('3.456') });
    const result = await withKeys().fetchGasPriceRaw('regular');
    expect(result).toMatchObject({ pricePerGallon: 3.456, source: 'api' });
    expect(Number.isNaN(Date.parse(result.fetchedAt))).toBe(false);
  });

  test('accepts a numeric value as well as a string', async () => {
    mockApi({ [EIA]: eia(3.6) });
    expect((await withKeys().fetchGasPriceRaw('regular')).pricePerGallon).toBe(3.6);
  });
});

describe('choosing the region', () => {
  test('without a location, uses the national average', async () => {
    const api = mockApi({ [EIA]: eia('3.4') });
    await withKeys().fetchGasPriceRaw('regular');
    expect(facets(api.all[0]).area).toBe('NUS');
  });

  test.each([
    ['NC', 'R1Z'], // Lower Atlantic PADD
    ['CA', 'SCA'], // California has its own series
    ['WA', 'SWA'],
    ['TX', 'STX'],
    ['NY', 'SNY'],
    ['AK', 'R5XCA'], // West Coast excluding CA
    ['IL', 'R20'], // Midwest
    ['LA', 'R30'], // Gulf Coast
    ['MT', 'R40'], // Rocky Mountain
    ['DC', 'R1Y'], // Central Atlantic
    ['VT', 'R1X'], // New England
  ])('%s is priced from EIA area %s', async (code, area) => {
    const api = mockApi({ [REVERSE]: state(code), [EIA]: eia('3.4') });
    await withKeys().fetchGasPriceRaw('regular', CHARLOTTE);
    expect(facets(api.all.find((c) => c.url.includes('eia.gov'))!).area).toBe(area);
  });

  test('a state with no EIA mapping uses the national average', async () => {
    const api = mockApi({ [REVERSE]: state('PR'), [EIA]: eia('3.4') });
    await withKeys().fetchGasPriceRaw('regular', CHARLOTTE);
    expect(facets(api.all.find((c) => c.url.includes('eia.gov'))!).area).toBe('NUS');
  });

  test('an unknown location (no region) uses the national average', async () => {
    const api = mockApi({ [REVERSE]: state(null), [EIA]: eia('3.4') });
    await withKeys().fetchGasPriceRaw('regular', CHARLOTTE);
    expect(facets(api.all.find((c) => c.url.includes('eia.gov'))!).area).toBe('NUS');
  });

  test('a failed reverse geocode never blocks pricing', async () => {
    const api = mockApi({ [EIA]: eia('3.4') }); // reverse geocode 404s
    const result = await withKeys().fetchGasPriceRaw('regular', CHARLOTTE);
    expect(result.source).toBe('api');
    expect(facets(api.all.find((c) => c.url.includes('eia.gov'))!).area).toBe('NUS');
  });
});

describe('falling back', () => {
  const byArea = (prices: Record<string, string | null>) => (c: ApiCall) => eia(prices[facets(c).area!] ?? null);

  test('a region with no data falls back to the national average, not the stub', async () => {
    const api = mockApi({ [REVERSE]: state('NC'), [EIA]: byArea({ R1Z: null, NUS: '3.9' }) });
    const result = await withKeys().fetchGasPriceRaw('regular', CHARLOTTE);

    expect(result).toMatchObject({ pricePerGallon: 3.9, source: 'api' });
    const areas = api.all.filter((c) => c.url.includes('eia.gov')).map((c) => facets(c).area);
    expect(areas).toEqual(['R1Z', 'NUS']); // tried the region, then the nation
  });

  test('uses the regional price when it has one', async () => {
    const api = mockApi({ [REVERSE]: state('NC'), [EIA]: byArea({ R1Z: '3.5', NUS: '3.9' }) });
    expect((await withKeys().fetchGasPriceRaw('regular', CHARLOTTE)).pricePerGallon).toBe(3.5);
    expect(api.all.filter((c) => c.url.includes('eia.gov'))).toHaveLength(1);
  });

  test('with no national data either, falls back to the stub', async () => {
    mockApi({ [EIA]: eia(null) });
    expect(await withKeys().fetchGasPriceRaw('diesel')).toMatchObject({ pricePerGallon: 3.99, source: 'stub' });
  });

  test.each([
    ['an HTTP error', () => mockApi({})],
    ['a malformed response', () => mockApi({ [EIA]: { nope: true } })],
    ['a zero price', () => mockApi({ [EIA]: eia('0') })],
    ['a negative price', () => mockApi({ [EIA]: eia('-1') })],
    ['a non-numeric price', () => mockApi({ [EIA]: eia('n/a') })],
  ])('%s falls back to the stub instead of breaking the screen', async (_name, setup) => {
    setup();
    expect(await withKeys().fetchGasPriceRaw('regular')).toMatchObject({ pricePerGallon: 3.49, source: 'stub' });
  });

  test('a network failure falls back to the stub', async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await withKeys().fetchGasPriceRaw('regular')).toMatchObject({ source: 'stub' });
  });
});

describe('useGasPrice', () => {
  test('resolves to a price for the fuel grade', async () => {
    mockApi({});
    const { result } = await renderQueryHook(() => useGasPrice('premium'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ pricePerGallon: 4.19, source: 'stub' });
  });

  test('a location that moves by less than ~1km reuses the cached price', async () => {
    mockApi({});
    const moving = { at: { lat: 35.1501, lng: -80.9301 } };
    const { result, rerender, client } = await renderQueryHook(() => useGasPrice('regular', moving.at));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    moving.at = { lat: 35.1549, lng: -80.9349 }; // same 2-decimal cell
    await rerender(undefined);
    expect(client.getQueryCache().getAll()).toHaveLength(1);
  });

  test('a different fuel grade is a separate lookup', async () => {
    mockApi({});
    const grade = { current: 'regular' as 'regular' | 'diesel' };
    const { result, rerender } = await renderQueryHook(() => useGasPrice(grade.current));
    await waitFor(() => expect(result.current.data?.pricePerGallon).toBe(3.49));

    grade.current = 'diesel';
    await rerender(undefined);
    await waitFor(() => expect(result.current.data?.pricePerGallon).toBe(3.99));
  });
});
