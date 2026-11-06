import { pointAt, projectRoutes, thin, toPath } from '@/lib/map-projection';
import type { LatLng } from '@/schemas/routing';

const RECT = { x0: 0, y0: 0, x1: 100, y1: 50 };

describe('thin', () => {
  const line = (n: number): LatLng[] => Array.from({ length: n }, (_, i) => ({ lat: i, lng: i }));

  test('leaves short routes alone', () => {
    const short = line(20);
    expect(thin(short)).toBe(short);
  });

  test('reduces long routes to a drawable size', () => {
    expect(thin(line(5000))).toHaveLength(140);
  });

  test('always keeps the first and last points', () => {
    const long = line(5000);
    const out = thin(long);
    expect(out[0]).toEqual(long[0]);
    expect(out[out.length - 1]).toEqual(long[4999]);
  });

  test('keeps points in order', () => {
    const lats = thin(line(1000)).map((p) => p.lat);
    expect([...lats].sort((a, b) => a - b)).toEqual(lats);
  });
});

describe('projectRoutes', () => {
  test('returns an empty list for each empty route', () => {
    expect(projectRoutes([[], []], RECT)).toEqual([[], []]);
  });

  test('puts north at the top and east to the right', () => {
    const [[sw, ne]] = projectRoutes(
      [
        [
          { lat: 0, lng: 0 },
          { lat: 0.01, lng: 0.01 },
        ],
      ],
      RECT,
    );
    expect(ne.y).toBeLessThan(sw.y);
    expect(ne.x).toBeGreaterThan(sw.x);
  });

  test('keeps a square area square and centers it in a wider box', () => {
    // ~equal lat/lng span near the equator, in a 100×50 box: height fills, width is centered.
    const [[sw, ne]] = projectRoutes(
      [
        [
          { lat: 0, lng: 0 },
          { lat: 0.01, lng: 0.01 },
        ],
      ],
      RECT,
    );
    expect(ne.x - sw.x).toBeCloseTo(50, 1);
    expect(sw.y - ne.y).toBeCloseTo(50, 1);
    expect(sw.x).toBeCloseTo(25, 1);
    expect(ne.x).toBeCloseTo(75, 1);
  });

  test('keeps every point inside the rectangle', () => {
    const route: LatLng[] = [
      { lat: 35.12, lng: -80.93 },
      { lat: 35.15, lng: -80.9 },
      { lat: 35.1, lng: -80.88 },
    ];
    const [pts] = projectRoutes([route], { x0: 48, y0: 78, x1: 342, y1: 248 });
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(48 - 1e-9);
      expect(p.x).toBeLessThanOrEqual(342 + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(78 - 1e-9);
      expect(p.y).toBeLessThanOrEqual(248 + 1e-9);
    }
  });

  test('shares one scale across routes so relative shapes stay true', () => {
    const a: LatLng[] = [
      { lat: 0, lng: 0 },
      { lat: 0.02, lng: 0 },
    ];
    const b: LatLng[] = [
      { lat: 0, lng: 0 },
      { lat: 0.01, lng: 0 },
    ];
    const [pa, pb] = projectRoutes([a, b], RECT);
    const lenA = pa[0].y - pa[1].y;
    const lenB = pb[0].y - pb[1].y;
    expect(lenA / lenB).toBeCloseTo(2, 5);
  });

  test('a single point does not blow up', () => {
    const [[p]] = projectRoutes([[{ lat: 10, lng: 10 }]], RECT);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });

  test('narrows longitude with latitude so far-north maps are not stretched', () => {
    // A 0.02° × 0.01° (lng × lat) area, drawn in a square box. Degrees of longitude get
    // shorter away from the equator, so the picture's width:height ratio must shrink.
    const aspect = (lat: number) => {
      const [[a, b]] = projectRoutes(
        [
          [
            { lat, lng: 0 },
            { lat: lat + 0.01, lng: 0.02 },
          ],
        ],
        { x0: 0, y0: 0, x1: 1000, y1: 1000 },
      );
      return (b.x - a.x) / (a.y - b.y);
    };
    expect(aspect(0)).toBeCloseTo(2, 1); // true ground shape is 2:1 at the equator
    expect(aspect(60)).toBeCloseTo(1, 1); // cos(60°) = 0.5 halves the width on the ground
  });
});

describe('toPath', () => {
  test('builds an SVG path with one decimal place', () => {
    expect(
      toPath([
        { x: 0, y: 0 },
        { x: 10.46, y: 20 },
        { x: 30, y: 5.04 },
      ]),
    ).toBe('M0.0 0.0 L10.5 20.0 L30.0 5.0');
  });

  test('is empty for no points', () => {
    expect(toPath([])).toBe('');
  });
});

describe('pointAt', () => {
  const pts = [0, 1, 2, 3, 4].map((i) => ({ x: i, y: i }));

  test.each([
    [0, 0],
    [0.5, 2],
    [1, 4],
  ])('fraction %p is index %p', (fraction, index) => {
    expect(pointAt(pts, fraction)).toBe(pts[index]);
  });

  test('clamps out-of-range fractions', () => {
    expect(pointAt(pts, -1)).toBe(pts[0]);
    expect(pointAt(pts, 5)).toBe(pts[4]);
  });
});
