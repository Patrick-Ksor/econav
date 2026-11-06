import { LatLng } from '@/schemas/routing';

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Point {
  x: number;
  y: number;
}

const MAX_POINTS = 140;

/** Thins a dense polyline to a drawable size, always keeping both endpoints. */
export function thin(points: LatLng[]): LatLng[] {
  if (points.length <= MAX_POINTS) return points;
  const stride = (points.length - 1) / (MAX_POINTS - 1);
  return Array.from({ length: MAX_POINTS }, (_, i) => points[Math.round(i * stride)]);
}

/**
 * Fits every route into `rect` with one shared uniform scale, so routes keep their true
 * relative shape. Longitude is scaled by cos(latitude) so the picture isn't stretched.
 * North is up. Returns one projected point list per input route.
 */
export function projectRoutes(routes: LatLng[][], rect: Rect): Point[][] {
  const all = routes.flat();
  if (all.length === 0) return routes.map(() => []);

  const lats = all.map((p) => p.lat);
  const lngs = all.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const lngScale = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));

  const spanX = Math.max((maxLng - minLng) * lngScale, 1e-6);
  const spanY = Math.max(maxLat - minLat, 1e-6);
  const boxW = rect.x1 - rect.x0;
  const boxH = rect.y1 - rect.y0;
  const scale = Math.min(boxW / spanX, boxH / spanY);
  // Center whatever slack remains on the shorter axis.
  const offX = rect.x0 + (boxW - spanX * scale) / 2;
  const offY = rect.y0 + (boxH - spanY * scale) / 2;

  return routes.map((route) =>
    route.map((p) => ({
      x: offX + (p.lng - minLng) * lngScale * scale,
      y: offY + (maxLat - p.lat) * scale,
    })),
  );
}

export function toPath(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

/** Point a fraction of the way along a projected route (by index, which is close enough here). */
export function pointAt(points: Point[], fraction: number): Point {
  return points[Math.min(points.length - 1, Math.max(0, Math.round((points.length - 1) * fraction)))];
}
