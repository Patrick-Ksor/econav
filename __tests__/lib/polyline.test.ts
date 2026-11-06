import { decodePolyline, sampleWaypoints } from '@/lib/polyline';
import type { LatLng } from '@/schemas/routing';

describe('decodePolyline', () => {
  test("decodes Google's documented example", () => {
    // https://developers.google.com/maps/documentation/utilities/polylinealgorithm
    const points = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(points).toHaveLength(3);
    expect(points[0].lat).toBeCloseTo(38.5, 5);
    expect(points[0].lng).toBeCloseTo(-120.2, 5);
    expect(points[1].lat).toBeCloseTo(40.7, 5);
    expect(points[1].lng).toBeCloseTo(-120.95, 5);
    expect(points[2].lat).toBeCloseTo(43.252, 5);
    expect(points[2].lng).toBeCloseTo(-126.453, 5);
  });

  test('returns no points for an empty string', () => {
    expect(decodePolyline('')).toEqual([]);
  });

  test('supports polyline6 precision', () => {
    // The same path encoded at 1e-6 precision decodes to the same coordinates.
    const p5 = decodePolyline('_p~iF~ps|U', 5)[0];
    expect(p5.lat).toBeCloseTo(38.5, 5);
    const p6 = decodePolyline('_p~iF~ps|U', 6)[0];
    expect(p6.lat).toBeCloseTo(3.85, 5); // wrong precision shrinks it 10×, proving the factor is used
  });
});

describe('sampleWaypoints', () => {
  const route = (n: number): LatLng[] => Array.from({ length: n }, (_, i) => ({ lat: i, lng: i }));

  test('returns the requested number of interior points', () => {
    expect(sampleWaypoints(route(50), 3)).toHaveLength(3);
  });

  test('never includes the origin or destination', () => {
    const points = route(50);
    const sampled = sampleWaypoints(points, 3);
    expect(sampled).not.toContainEqual(points[0]);
    expect(sampled).not.toContainEqual(points[49]);
  });

  test('spreads points evenly along the route', () => {
    const lats = sampleWaypoints(route(41), 3).map((p) => p.lat);
    const gaps = [lats[1] - lats[0], lats[2] - lats[1]];
    expect(Math.abs(gaps[0] - gaps[1])).toBeLessThanOrEqual(1);
  });

  test('returns every interior point when there are fewer than requested', () => {
    expect(sampleWaypoints(route(4), 3)).toEqual([route(4)[1], route(4)[2]]);
  });

  test('returns nothing for a route with no interior', () => {
    expect(sampleWaypoints(route(2), 3)).toEqual([]);
    expect(sampleWaypoints([], 3)).toEqual([]);
  });
});
