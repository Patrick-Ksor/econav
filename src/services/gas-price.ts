import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { LatLng } from '@/schemas/routing';
import { FuelGrade } from '@/schemas/vehicle';

import { reverseGeocodeState } from './mapbox';

export const GasPriceResultSchema = z.object({
  pricePerGallon: z.number().positive(),
  source: z.enum(['stub', 'api']),
  fetchedAt: z.string(),
});
export type GasPriceResult = z.infer<typeof GasPriceResultSchema>;

const STUB_PRICES: Record<FuelGrade, number> = {
  regular: 3.49,
  premium: 4.19,
  diesel: 3.99,
};

const EIA_API_KEY = process.env.EXPO_PUBLIC_EIA_API_KEY;

// EIA "Gasoline and Diesel Fuel Update" product codes (weekly).
// Verify these against a live response if EIA ever changes its schema:
// https://api.eia.gov/v2/petroleum/pri/gnd/data/?api_key=YOUR_KEY
const EIA_PRODUCT_CODE: Record<FuelGrade, string> = {
  regular: 'EPMR',
  premium: 'EPMP',
  diesel: 'EPD2D',
};

const NATIONAL_AREA = 'NUS';

/**
 * EIA only publishes weekly retail gasoline prices at the national level, 5 PADD
 * regions (3 of which split further for the East Coast), and a handful of
 * individually-tracked states — not all 50 states. Confirmed by querying
 * https://api.eia.gov/v2/petroleum/pri/gnd/data/ directly for every `duoarea`
 * code currently in use. States with their own series use it directly; every
 * other state falls back to its PADD (or PADD sub-region) code.
 */
const STATE_TO_EIA_AREA: Record<string, string> = {
  // States with a dedicated weekly series — more granular than their PADD.
  CA: 'SCA',
  CO: 'SCO',
  FL: 'SFL',
  MA: 'SMA',
  MN: 'SMN',
  NY: 'SNY',
  OH: 'SOH',
  TX: 'STX',
  WA: 'SWA',
  // PADD 1A — New England
  CT: 'R1X',
  ME: 'R1X',
  NH: 'R1X',
  RI: 'R1X',
  VT: 'R1X',
  // PADD 1B — Central Atlantic
  DE: 'R1Y',
  DC: 'R1Y',
  MD: 'R1Y',
  NJ: 'R1Y',
  PA: 'R1Y',
  // PADD 1C — Lower Atlantic
  GA: 'R1Z',
  NC: 'R1Z',
  SC: 'R1Z',
  VA: 'R1Z',
  WV: 'R1Z',
  // PADD 2 — Midwest
  IL: 'R20',
  IN: 'R20',
  IA: 'R20',
  KS: 'R20',
  KY: 'R20',
  MI: 'R20',
  MO: 'R20',
  NE: 'R20',
  ND: 'R20',
  OK: 'R20',
  SD: 'R20',
  TN: 'R20',
  WI: 'R20',
  // PADD 3 — Gulf Coast
  AL: 'R30',
  AR: 'R30',
  LA: 'R30',
  MS: 'R30',
  NM: 'R30',
  // PADD 4 — Rocky Mountain
  ID: 'R40',
  MT: 'R40',
  UT: 'R40',
  WY: 'R40',
  // PADD 5 — West Coast, excluding CA (which has its own series above)
  AK: 'R5XCA',
  AZ: 'R5XCA',
  HI: 'R5XCA',
  NV: 'R5XCA',
  OR: 'R5XCA',
};

const EiaResponseSchema = z.object({
  response: z.object({
    data: z.array(z.object({ value: z.union([z.string(), z.number()]) })),
  }),
});

async function fetchGasPriceFromEia(
  fuelGrade: FuelGrade,
  duoarea: string,
): Promise<GasPriceResult | null> {
  if (!EIA_API_KEY) {
    return null;
  }
  try {
    const params = new URLSearchParams({
      api_key: EIA_API_KEY,
      frequency: 'weekly',
      'data[0]': 'value',
      'facets[product][]': EIA_PRODUCT_CODE[fuelGrade],
      'facets[duoarea][]': duoarea,
      'sort[0][column]': 'period',
      'sort[0][direction]': 'desc',
      length: '1',
    });
    const res = await fetch(`https://api.eia.gov/v2/petroleum/pri/gnd/data/?${params}`);
    if (!res.ok) {
      return null;
    }
    const json = EiaResponseSchema.parse(await res.json());
    const latest = json.response.data[0];
    const pricePerGallon = latest ? Number(latest.value) : NaN;
    if (!Number.isFinite(pricePerGallon) || pricePerGallon <= 0) {
      return null;
    }
    return GasPriceResultSchema.parse({
      pricePerGallon,
      source: 'api',
      fetchedAt: new Date().toISOString(),
    });
  } catch {
    // Never let a flaky external API break the Garage screen — fall back to the stub.
    return null;
  }
}

/**
 * Tries EIA's weekly gasoline price for the user's region first (state-level or
 * PADD-level, whichever EIA actually publishes — see STATE_TO_EIA_AREA), falling
 * back to the national average if no location is available, and to a fixed stub
 * estimate if EIA has no key configured or the request fails outright. The manual
 * override in Garage always takes precedence over any of these — see GasPriceField.
 */
export async function fetchGasPriceRaw(
  fuelGrade: FuelGrade,
  location?: LatLng,
): Promise<GasPriceResult> {
  let area = NATIONAL_AREA;
  if (location) {
    const stateCode = await reverseGeocodeState(location).catch(() => null);
    if (stateCode && STATE_TO_EIA_AREA[stateCode]) {
      area = STATE_TO_EIA_AREA[stateCode];
    }
  }

  const apiResult = await fetchGasPriceFromEia(fuelGrade, area);
  if (apiResult) {
    return apiResult;
  }
  // If the region-specific series had no data, national average is a better
  // fallback than the fixed stub before giving up entirely.
  if (area !== NATIONAL_AREA) {
    const nationalResult = await fetchGasPriceFromEia(fuelGrade, NATIONAL_AREA);
    if (nationalResult) {
      return nationalResult;
    }
  }
  return GasPriceResultSchema.parse({
    pricePerGallon: STUB_PRICES[fuelGrade],
    source: 'stub',
    fetchedAt: new Date().toISOString(),
  });
}

export function useGasPrice(fuelGrade: FuelGrade, location?: LatLng) {
  return useQuery({
    // Rounded to ~1km precision — state-level lookup doesn't need exact GPS, and
    // this keeps minor position jitter from triggering redundant refetches.
    queryKey: [
      'gas-price',
      fuelGrade,
      location ? location.lat.toFixed(2) : null,
      location ? location.lng.toFixed(2) : null,
    ],
    queryFn: () => fetchGasPriceRaw(fuelGrade, location),
    staleTime: 60 * 60_000,
  });
}
