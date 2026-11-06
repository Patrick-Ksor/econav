import { LatLng } from '@/schemas/routing';

/**
 * Decodes a Google/Mapbox-format encoded polyline (precision 5, matching Mapbox's
 * default `geometries=polyline` — not `polyline6`) into an ordered list of points.
 */
export function decodePolyline(encoded: string, precision = 5): LatLng[] {
  const factor = 10 ** precision;
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / factor, lng: lng / factor });
  }

  return points;
}

/**
 * Picks `count` evenly-spaced interior points from a decoded route (excluding the
 * origin/destination endpoints) to use as waypoints — enough to bias an external
 * map app toward the same path without hitting its waypoint-count limits.
 */
export function sampleWaypoints(points: LatLng[], count: number): LatLng[] {
  const interior = points.slice(1, -1);
  if (interior.length <= count) {
    return interior;
  }
  const step = interior.length / (count + 1);
  const sampled: LatLng[] = [];
  for (let i = 1; i <= count; i++) {
    sampled.push(interior[Math.round(i * step) - 1]);
  }
  return sampled;
}
