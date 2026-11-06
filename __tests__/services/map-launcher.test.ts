import { Linking, Platform } from 'react-native';

import { isAppleMapsAvailable, openInExternalMap } from '@/services/map-launcher';

const ORIGIN = { lat: 35.15, lng: -80.93 };
const DEST = { lat: 35.1, lng: -80.88 };

let openURL: jest.SpyInstance;
let canOpenURL: jest.SpyInstance;

beforeEach(() => {
  // jest-expo already mocks Linking, so spyOn returns the same mock each time: clear its history.
  openURL = jest.spyOn(Linking, 'openURL').mockClear().mockResolvedValue(true);
  canOpenURL = jest.spyOn(Linking, 'canOpenURL').mockClear().mockResolvedValue(true);
});

afterEach(() => jest.restoreAllMocks());

const opened = () => new URL(openURL.mock.calls[0][0] as string);

describe('Google Maps', () => {
  test('opens directions from the origin to the destination by car', async () => {
    await openInExternalMap('google', { origin: ORIGIN, destination: DEST });

    const url = opened();
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/dir/');
    expect(url.searchParams.get('api')).toBe('1');
    expect(url.searchParams.get('origin')).toBe('35.15,-80.93');
    expect(url.searchParams.get('destination')).toBe('35.1,-80.88');
    expect(url.searchParams.get('travelmode')).toBe('driving');
  });

  test('omits the origin so Google uses the device location', async () => {
    await openInExternalMap('google', { destination: DEST });
    expect(opened().searchParams.has('origin')).toBe(false);
  });

  test('passes waypoints, pipe-separated, to keep Google on the same route', async () => {
    await openInExternalMap('google', {
      origin: ORIGIN,
      destination: DEST,
      waypoints: [
        { lat: 35.14, lng: -80.92 },
        { lat: 35.12, lng: -80.9 },
      ],
    });
    expect(opened().searchParams.get('waypoints')).toBe('35.14,-80.92|35.12,-80.9');
  });

  test('sends no waypoints parameter when there are none', async () => {
    await openInExternalMap('google', { origin: ORIGIN, destination: DEST, waypoints: [] });
    expect(opened().searchParams.has('waypoints')).toBe(false);
  });
});

describe('Apple Maps', () => {
  test('opens driving directions with start and end addresses', async () => {
    await openInExternalMap('apple', { origin: ORIGIN, destination: DEST });

    const url = opened();
    expect(url.origin + url.pathname).toBe('https://maps.apple.com/');
    expect(url.searchParams.get('saddr')).toBe('35.15,-80.93');
    expect(url.searchParams.get('daddr')).toBe('35.1,-80.88');
    expect(url.searchParams.get('dirflg')).toBe('d');
  });

  test('omits the start address when there is no origin', async () => {
    await openInExternalMap('apple', { destination: DEST });
    expect(opened().searchParams.has('saddr')).toBe(false);
  });
});

describe('Waze', () => {
  test('prefers the installed app and starts navigating', async () => {
    await openInExternalMap('waze', { origin: ORIGIN, destination: DEST });
    expect(openURL).toHaveBeenCalledWith('waze://?ll=35.1,-80.88&navigate=yes');
  });

  test('ignores the origin: Waze always starts from the device location', async () => {
    await openInExternalMap('waze', { origin: ORIGIN, destination: DEST });
    expect(openURL.mock.calls[0][0]).not.toContain('35.15');
  });

  test('falls back to the web link when the app is not installed', async () => {
    canOpenURL.mockResolvedValue(false);
    await openInExternalMap('waze', { destination: DEST });
    expect(openURL).toHaveBeenCalledWith('https://waze.com/ul?ll=35.1,-80.88&navigate=yes');
  });

  test('on web it never probes for the app and uses the web link', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    await openInExternalMap('waze', { destination: DEST });

    expect(canOpenURL).not.toHaveBeenCalled();
    expect(openURL).toHaveBeenCalledWith('https://waze.com/ul?ll=35.1,-80.88&navigate=yes');
  });
});

test('a failure to open the link reaches the caller', async () => {
  openURL.mockRejectedValue(new Error('no handler'));
  await expect(openInExternalMap('google', { destination: DEST })).rejects.toThrow('no handler');
});

describe('isAppleMapsAvailable', () => {
  test.each([
    ['ios', true],
    ['android', false],
    ['web', false],
  ] as const)('%s → %s', (os, expected) => {
    jest.replaceProperty(Platform, 'OS', os);
    expect(isAppleMapsAvailable()).toBe(expected);
  });
});
