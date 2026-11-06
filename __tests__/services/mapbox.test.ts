import { loadFresh } from '../helpers/load';
import { mockApi } from '../helpers/api';

type Mapbox = typeof import('@/services/mapbox');
const withToken = () =>
  loadFresh<Mapbox>(() => require('@/services/mapbox'), { EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: 'pk.test' });
const withoutToken = () =>
  loadFresh<Mapbox>(() => require('@/services/mapbox'), { EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: undefined });

const SUGGEST = '/search/searchbox/v1/suggest';
const RETRIEVE = '/search/searchbox/v1/retrieve/';
const REVERSE = '/search/geocode/v6/reverse';
const DIRECTIONS = '/directions/v5/mapbox/driving-traffic/';

const METERS_PER_MILE = 1609.344;

describe('without an access token', () => {
  test.each([
    ['reverseGeocodeState', (m: Mapbox) => m.reverseGeocodeState({ lat: 1, lng: 2 })],
    ['searchPlacesRaw', (m: Mapbox) => m.searchPlacesRaw('abc', 's')],
    ['getPlaceDetailsRaw', (m: Mapbox) => m.getPlaceDetailsRaw('id', 's')],
    ['computeFuelAwareRoutesRaw', (m: Mapbox) => m.computeFuelAwareRoutesRaw({ lat: 1, lng: 2 }, { lat: 3, lng: 4 }, 30, 3)],
  ])('%s explains how to configure it instead of calling Mapbox', async (_name, call) => {
    const api = mockApi({});
    await expect(call(withoutToken())).rejects.toThrow('Missing EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN');
    expect(api.all).toHaveLength(0);
  });
});

describe('reverseGeocodeState', () => {
  const reply = (region?: Record<string, string>) => ({
    features: region ? [{ properties: { context: { region } } }] : [],
  });

  test('asks for the region at the given point', async () => {
    const api = mockApi({ [`GET ${REVERSE}`]: reply({ region_code: 'NC', region_code_full: 'US-NC' }) });
    await withToken().reverseGeocodeState({ lat: 35.15, lng: -80.93 });

    const [url] = api.urlsTo('https://api.mapbox.com/search/geocode/v6/reverse');
    expect(url.searchParams.get('latitude')).toBe('35.15');
    expect(url.searchParams.get('longitude')).toBe('-80.93');
    expect(url.searchParams.get('types')).toBe('region');
    expect(url.searchParams.get('access_token')).toBe('pk.test');
  });

  test('returns the US state code', async () => {
    mockApi({ [`GET ${REVERSE}`]: reply({ region_code: 'NC', region_code_full: 'US-NC' }) });
    expect(await withToken().reverseGeocodeState({ lat: 35.15, lng: -80.93 })).toBe('NC');
  });

  test('returns null outside the US', async () => {
    mockApi({ [`GET ${REVERSE}`]: reply({ region_code: 'ON', region_code_full: 'CA-ON' }) });
    expect(await withToken().reverseGeocodeState({ lat: 43.7, lng: -79.4 })).toBeNull();
  });

  test('returns null when Mapbox knows of no region', async () => {
    mockApi({ [`GET ${REVERSE}`]: reply() });
    expect(await withToken().reverseGeocodeState({ lat: 0, lng: 0 })).toBeNull();
  });

  test('returns null when the lookup fails, so callers fall back', async () => {
    mockApi({}); // 404
    expect(await withToken().reverseGeocodeState({ lat: 1, lng: 1 })).toBeNull();
  });
});

describe('searchPlacesRaw', () => {
  const suggestion = (over: Record<string, unknown> = {}) => ({
    mapbox_id: 'mb1',
    name: 'Target',
    full_address: '9531 South Blvd, Charlotte, NC 28273',
    place_formatted: 'Charlotte, NC 28273',
    ...over,
  });

  test('sends the query, the billing session token and a result limit', async () => {
    const api = mockApi({ [`GET ${SUGGEST}`]: { suggestions: [suggestion()] } });
    await withToken().searchPlacesRaw('targ', 'session-1');

    const [url] = api.urlsTo('https://api.mapbox.com/search/searchbox/v1/suggest');
    expect(url.searchParams.get('q')).toBe('targ');
    expect(url.searchParams.get('session_token')).toBe('session-1');
    expect(url.searchParams.get('limit')).toBe('8');
    expect(url.searchParams.get('access_token')).toBe('pk.test');
    expect(url.searchParams.has('proximity')).toBe(false);
  });

  test('biases results with "lng,lat" proximity when a location is known', async () => {
    const api = mockApi({ [`GET ${SUGGEST}`]: { suggestions: [] } });
    await withToken().searchPlacesRaw('targ', 's', { lat: 35.15, lng: -80.93 });

    const [url] = api.urlsTo('https://api.mapbox.com/search/searchbox/v1/suggest');
    expect(url.searchParams.get('proximity')).toBe('-80.93,35.15'); // longitude first
  });

  test('maps suggestions to the app shape', async () => {
    mockApi({ [`GET ${SUGGEST}`]: { suggestions: [suggestion()] } });
    expect(await withToken().searchPlacesRaw('targ', 's')).toEqual([
      { placeId: 'mb1', primaryText: 'Target', secondaryText: '9531 South Blvd, Charlotte, NC 28273' },
    ]);
  });

  test('prefers the full street address, then the city, then nothing', async () => {
    mockApi({
      [`GET ${SUGGEST}`]: {
        suggestions: [
          suggestion({ mapbox_id: 'a' }),
          suggestion({ mapbox_id: 'b', full_address: undefined }),
          suggestion({ mapbox_id: 'c', full_address: undefined, place_formatted: undefined }),
        ],
      },
    });
    const out = await withToken().searchPlacesRaw('targ', 's');
    expect(out.map((s) => s.secondaryText)).toEqual([
      '9531 South Blvd, Charlotte, NC 28273',
      'Charlotte, NC 28273',
      '',
    ]);
  });

  test('no suggestions is an empty list, not an error', async () => {
    mockApi({ [`GET ${SUGGEST}`]: {} });
    expect(await withToken().searchPlacesRaw('zzz', 's')).toEqual([]);
  });

  test('a failed request throws with the status', async () => {
    mockApi({}); // 404
    await expect(withToken().searchPlacesRaw('targ', 's')).rejects.toThrow('Mapbox suggest failed: 404');
  });

  test('rejects a suggestion that is missing its id', async () => {
    mockApi({ [`GET ${SUGGEST}`]: { suggestions: [suggestion({ mapbox_id: undefined })] } });
    await expect(withToken().searchPlacesRaw('targ', 's')).rejects.toThrow();
  });
});

describe('getPlaceDetailsRaw', () => {
  const feature = (over: Record<string, unknown> = {}) => ({
    geometry: { coordinates: [-80.88, 35.1] }, // GeoJSON order: [lng, lat]
    properties: { full_address: '9531 South Blvd, Charlotte, NC', name: 'Target' },
    ...over,
  });

  test('reads the place id and session token into the request', async () => {
    const api = mockApi({ [`GET ${RETRIEVE}*`]: { features: [feature()] } });
    await withToken().getPlaceDetailsRaw('mb1', 'session-1');

    const [url] = api.urlsTo('https://api.mapbox.com/search/searchbox/v1/retrieve/mb1');
    expect(url.pathname).toBe('/search/searchbox/v1/retrieve/mb1');
    expect(url.searchParams.get('session_token')).toBe('session-1');
  });

  test('un-transposes GeoJSON [lng, lat] into { lat, lng }', async () => {
    mockApi({ [`GET ${RETRIEVE}*`]: { features: [feature()] } });
    const place = await withToken().getPlaceDetailsRaw('mb1', 's');
    expect(place.location).toEqual({ lat: 35.1, lng: -80.88 });
    expect(place.placeId).toBe('mb1');
  });

  test('uses the full address, falling back to the name, then to an empty string', async () => {
    mockApi({
      [`GET ${RETRIEVE}*`]: ({ path }: { path: string }) => ({
        features: [
          path.split('?')[0].endsWith('full')
            ? feature()
            : path.split('?')[0].endsWith('name')
              ? feature({ properties: { name: 'Target' } })
              : feature({ properties: {} }),
        ],
      }),
    });
    const m = withToken();
    expect((await m.getPlaceDetailsRaw('full', 's')).formattedAddress).toBe('9531 South Blvd, Charlotte, NC');
    expect((await m.getPlaceDetailsRaw('name', 's')).formattedAddress).toBe('Target');
    expect((await m.getPlaceDetailsRaw('none', 's')).formattedAddress).toBe('');
  });

  test('throws when Mapbox has no details for the place', async () => {
    mockApi({ [`GET ${RETRIEVE}*`]: { features: [] } });
    await expect(withToken().getPlaceDetailsRaw('mb1', 's')).rejects.toThrow('No details found for this place');
  });

  test('a failed request throws with the status', async () => {
    mockApi({});
    await expect(withToken().getPlaceDetailsRaw('mb1', 's')).rejects.toThrow('Mapbox retrieve failed: 404');
  });
});

describe('computeFuelAwareRoutesRaw', () => {
  const ORIGIN = { lat: 35.15, lng: -80.93 };
  const DEST = { lat: 35.1, lng: -80.88 };
  const route = (miles: number, minutes: number, extra: Record<string, unknown> = {}) => ({
    distance: miles * METERS_PER_MILE,
    duration: minutes * 60,
    geometry: `poly-${miles}`,
    ...extra,
  });
  const serve = (routes: unknown[]) => mockApi({ [`GET ${DIRECTIONS}*`]: { routes } });

  test('requests driving-traffic directions with alternatives and full geometry', async () => {
    const api = serve([route(10, 20)]);
    await withToken().computeFuelAwareRoutesRaw(ORIGIN, DEST, 30, 3);

    const [url] = api.urlsTo('https://api.mapbox.com/directions/v5/mapbox/driving-traffic/');
    // Coordinates are "lng,lat;lng,lat", origin first.
    expect(decodeURIComponent(url.pathname)).toBe(`${DIRECTIONS}-80.93,35.15;-80.88,35.1`);
    expect(url.searchParams.get('alternatives')).toBe('true');
    expect(url.searchParams.get('overview')).toBe('full');
    expect(url.searchParams.get('geometries')).toBe('polyline');
    expect(url.searchParams.get('access_token')).toBe('pk.test');
  });

  test('converts meters to miles and seconds to minutes', async () => {
    serve([route(10, 20)]);
    const { standard } = await withToken().computeFuelAwareRoutesRaw(ORIGIN, DEST, 30, 3);
    expect(standard.distanceMiles).toBeCloseTo(10, 6);
    expect(standard.durationMinutes).toBeCloseTo(20, 6);
  });

  test('estimates fuel as miles ÷ MPG, and cost as gallons × price', async () => {
    serve([route(60, 60)]);
    const { standard } = await withToken().computeFuelAwareRoutesRaw(ORIGIN, DEST, 30, 4);
    expect(standard.gallonsUsed).toBeCloseTo(2, 6);
    expect(standard.estimatedCost).toBeCloseTo(8, 6);
  });

  test('the first route is "standard"; the shortest is "fuel_efficient"', async () => {
    serve([route(12, 15), route(10, 22), route(11, 18)]);
    const { optimized, standard } = await withToken().computeFuelAwareRoutesRaw(ORIGIN, DEST, 30, 3);

    expect(standard.kind).toBe('standard');
    expect(standard.distanceMiles).toBeCloseTo(12, 6);
    expect(optimized.kind).toBe('fuel_efficient');
    expect(optimized.distanceMiles).toBeCloseTo(10, 6);
    expect(optimized.encodedPolyline).toBe('poly-10');
  });

  test('with one route, both options are that route', async () => {
    serve([route(10, 20)]);
    const { optimized, standard } = await withToken().computeFuelAwareRoutesRaw(ORIGIN, DEST, 30, 3);
    expect(optimized.distanceMiles).toBeCloseTo(standard.distanceMiles, 10);
  });

  test('keeps typical (no-traffic) duration so traffic delay can be shown', async () => {
    serve([route(10, 25, { duration_typical: 20 * 60 })]);
    const { standard } = await withToken().computeFuelAwareRoutesRaw(ORIGIN, DEST, 30, 3);
    expect(standard.durationTypicalMinutes).toBeCloseTo(20, 6);
  });

  test('leaves typical duration undefined when Mapbox omits it', async () => {
    serve([route(10, 25)]);
    const { standard } = await withToken().computeFuelAwareRoutesRaw(ORIGIN, DEST, 30, 3);
    expect(standard.durationTypicalMinutes).toBeUndefined();
  });

  test('throws when no route exists between the points', async () => {
    serve([]);
    await expect(withToken().computeFuelAwareRoutesRaw(ORIGIN, DEST, 30, 3)).rejects.toThrow(
      'No route returned for this origin/destination',
    );
  });

  test('a failed request throws with the status', async () => {
    mockApi({});
    await expect(withToken().computeFuelAwareRoutesRaw(ORIGIN, DEST, 30, 3)).rejects.toThrow(
      'Mapbox directions failed: 404',
    );
  });
});
