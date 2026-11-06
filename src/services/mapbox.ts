import { z } from 'zod';

import {
  ComputedRouteOption,
  ComputedRouteOptionSchema,
  LatLng,
  PlaceDetails,
  PlaceDetailsSchema,
  PlaceSuggestion,
  PlaceSuggestionSchema,
} from '@/schemas/routing';

const ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

const METERS_PER_MILE = 1609.344;

function assertAccessToken() {
  if (!ACCESS_TOKEN) {
    throw new Error(
      'Missing EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN. Add it to a .env.local file (never a plain .env).',
    );
  }
}

/**
 * Reverse-geocodes a point to its US state code (e.g. "WA") via Mapbox's Geocoding
 * v6 reverse endpoint, filtered to `region`-type features. Returns null for
 * non-US locations or lookup failures — callers fall back to a national default.
 */
export async function reverseGeocodeState(location: LatLng): Promise<string | null> {
  assertAccessToken();
  const params = new URLSearchParams({
    longitude: String(location.lng),
    latitude: String(location.lat),
    access_token: ACCESS_TOKEN!,
    types: 'region',
  });
  const res = await fetch(`https://api.mapbox.com/search/geocode/v6/reverse?${params}`);
  if (!res.ok) {
    return null;
  }
  const json = await res.json();
  const region = json.features?.[0]?.properties?.context?.region;
  if (region?.region_code_full && !region.region_code_full.startsWith('US-')) {
    return null; // non-US region
  }
  return region?.region_code ?? null;
}

/**
 * Mapbox's Search Box API is a two-step suggest -> retrieve flow (unlike HERE's
 * autosuggest, which returned coordinates directly): `suggest` only returns a
 * `mapbox_id` + display text, and a separate `retrieve` call resolves coordinates.
 * `sessionToken` must be the same value across a suggest+retrieve pair — Mapbox bills
 * per search session, not per call — so callers generate one token per search UI
 * session and reuse it for both functions below.
 */
export async function searchPlacesRaw(
  input: string,
  sessionToken: string,
  locationBias?: LatLng,
): Promise<PlaceSuggestion[]> {
  assertAccessToken();
  const params = new URLSearchParams({
    q: input,
    access_token: ACCESS_TOKEN!,
    session_token: sessionToken,
    limit: '8',
  });
  if (locationBias) {
    params.set('proximity', `${locationBias.lng},${locationBias.lat}`);
  }

  const res = await fetch(`https://api.mapbox.com/search/searchbox/v1/suggest?${params}`);
  if (!res.ok) {
    throw new Error(`Mapbox suggest failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  const suggestions = (json.suggestions ?? []).map((s: any) => ({
    placeId: s.mapbox_id,
    primaryText: s.name,
    // `full_address` includes the street line ("174 Union Street, Seattle, WA...");
    // `place_formatted` is city/state/zip only and omits the street for POIs like
    // stores, so it's only a fallback for suggestions with no street address (e.g.
    // brand-only or region-level results).
    secondaryText: s.full_address ?? s.place_formatted ?? '',
  }));
  return z.array(PlaceSuggestionSchema).parse(suggestions);
}

export async function getPlaceDetailsRaw(
  placeId: string,
  sessionToken: string,
): Promise<PlaceDetails> {
  assertAccessToken();
  const params = new URLSearchParams({ access_token: ACCESS_TOKEN!, session_token: sessionToken });
  const res = await fetch(
    `https://api.mapbox.com/search/searchbox/v1/retrieve/${placeId}?${params}`,
  );
  if (!res.ok) {
    throw new Error(`Mapbox retrieve failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  const feature = json.features?.[0];
  if (!feature) {
    throw new Error('No details found for this place');
  }
  // GeoJSON coordinate order is [lng, lat] — easy to transpose, so destructure explicitly.
  const [lng, lat] = feature.geometry.coordinates;
  return PlaceDetailsSchema.parse({
    placeId,
    location: { lat, lng },
    formattedAddress: feature.properties?.full_address ?? feature.properties?.name ?? '',
  });
}

interface MapboxRoute {
  distance: number; // meters
  duration: number; // seconds, live-traffic-aware (driving-traffic profile)
  duration_typical?: number; // seconds, typical/free-flow — driving-traffic profile only
  geometry?: string; // encoded polyline (precision 5), used to bias external map apps
}

async function fetchMapboxRoutes(origin: LatLng, destination: LatLng): Promise<MapboxRoute[]> {
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const params = new URLSearchParams({
    alternatives: 'true',
    overview: 'full',
    geometries: 'polyline',
    access_token: ACCESS_TOKEN!,
  });
  // `driving-traffic` factors in live + historical congestion and returns both a
  // traffic-aware `duration` and a typical/free-flow `duration_typical` per route,
  // with no extra request param needed — that pair is what powers the traffic-delay
  // figure shown on the Routes screen's computed-route card.
  const res = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?${params}`,
  );
  if (!res.ok) {
    throw new Error(`Mapbox directions failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  const routes: MapboxRoute[] = json.routes ?? [];
  if (routes.length === 0) {
    throw new Error('No route returned for this origin/destination');
  }
  return routes;
}

function toComputedRouteOption(
  route: MapboxRoute,
  kind: ComputedRouteOption['kind'],
  mpg: number,
  pricePerGallon: number,
): ComputedRouteOption {
  const distanceMiles = route.distance / METERS_PER_MILE;
  const durationMinutes = route.duration / 60;
  // Mapbox's Directions API has no dedicated eco/fuel-efficient profile (only
  // driving/driving-traffic/walking/cycling), so gallons are estimated from
  // distance/mpg rather than a real consumption figure.
  const gallonsUsed = distanceMiles / mpg;
  return ComputedRouteOptionSchema.parse({
    kind,
    distanceMiles,
    durationMinutes,
    durationTypicalMinutes:
      route.duration_typical != null ? route.duration_typical / 60 : undefined,
    gallonsUsed,
    estimatedCost: gallonsUsed * pricePerGallon,
    encodedPolyline: route.geometry,
  });
}

/**
 * Mapbox's `alternatives=true` returns up to 2 routes in one request, ranked by its
 * own recommendation — not a distance-vs-time toggle. `routes[0]` (the primary,
 * recommended route) is used as "standard"; whichever returned route has the
 * shortest distance (which may be the same route) is used as the "optimized" proxy.
 */
export async function computeFuelAwareRoutesRaw(
  origin: LatLng,
  destination: LatLng,
  mpg: number,
  pricePerGallon: number,
): Promise<{ optimized: ComputedRouteOption; standard: ComputedRouteOption }> {
  assertAccessToken();
  const routes = await fetchMapboxRoutes(origin, destination);
  const standardRaw = routes[0];
  const optimizedRaw = routes.reduce(
    (shortest, route) => (route.distance < shortest.distance ? route : shortest),
    routes[0],
  );
  return {
    optimized: toComputedRouteOption(optimizedRaw, 'fuel_efficient', mpg, pricePerGallon),
    standard: toComputedRouteOption(standardRaw, 'standard', mpg, pricePerGallon),
  };
}
