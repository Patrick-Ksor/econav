import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { FuelGrade, FuelGradeSchema } from '@/schemas/vehicle';

const BASE_URL = 'https://www.fueleconomy.gov/ws/rest/vehicle';

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return match ? decodeXmlEntities(match[1]) : null;
}

interface MenuItem {
  text: string;
  value: string;
}

/**
 * fueleconomy.gov (EPA) is a free, keyless, government-run API — no rate limit or
 * signup required. Its responses are XML only (`format=json` is silently ignored),
 * so this hand-rolls a small regex parser rather than adding an XML library for
 * what is always a flat, attribute-free `<menuItems><menuItem>...` shape — verified
 * against live requests rather than assumed.
 */
function parseMenuItems(xml: string): MenuItem[] {
  const items: MenuItem[] = [];
  const itemRegex = /<menuItem>\s*<text>([^<]*)<\/text>\s*<value>([^<]*)<\/value>\s*<\/menuItem>/g;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml))) {
    items.push({ text: decodeXmlEntities(match[1]), value: decodeXmlEntities(match[2]) });
  }
  return items;
}

async function fetchMenu(path: string): Promise<MenuItem[]> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`fueleconomy.gov request failed: ${res.status}`);
  }
  return parseMenuItems(await res.text());
}

export async function fetchVehicleYearsRaw(): Promise<string[]> {
  const items = await fetchMenu('/menu/year');
  return items.map((item) => item.value);
}

export async function fetchVehicleMakesRaw(year: string): Promise<string[]> {
  const items = await fetchMenu(`/menu/make?year=${encodeURIComponent(year)}`);
  return items.map((item) => item.value);
}

export async function fetchVehicleModelsRaw(year: string, make: string): Promise<string[]> {
  const items = await fetchMenu(
    `/menu/model?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}`,
  );
  return items.map((item) => item.value);
}

export interface VehicleTrimOption {
  id: string;
  label: string;
}

export async function fetchVehicleTrimsRaw(
  year: string,
  make: string,
  model: string,
): Promise<VehicleTrimOption[]> {
  const items = await fetchMenu(
    `/menu/options?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`,
  );
  return items.map((item) => ({ id: item.value, label: item.text }));
}

export const VehicleFuelDataSchema = z.object({
  // `comb08` is EPA combined city/highway MPG. For pure EVs it's actually MPGe, and
  // there's no per-gallon cost to compute, so this is null whenever `isElectric` is
  // true or the record has no usable gasoline MPG — callers fall back to manual entry.
  mpg: z.number().positive().nullable(),
  fuelGrade: FuelGradeSchema,
  isElectric: z.boolean(),
});
export type VehicleFuelData = z.infer<typeof VehicleFuelDataSchema>;

function mapFuelType(fuelType1: string): FuelGrade {
  const lower = fuelType1.toLowerCase();
  if (lower.includes('premium')) return 'premium';
  if (lower.includes('diesel')) return 'diesel';
  return 'regular';
}

export async function fetchVehicleFuelDataRaw(trimId: string): Promise<VehicleFuelData> {
  const res = await fetch(`${BASE_URL}/${trimId}`);
  if (!res.ok) {
    throw new Error(`fueleconomy.gov vehicle lookup failed: ${res.status}`);
  }
  const xml = await res.text();
  const comb08 = Number(extractTag(xml, 'comb08'));
  const fuelType1 = extractTag(xml, 'fuelType1') ?? '';
  const atvType = extractTag(xml, 'atvType') ?? '';
  const isElectric = atvType === 'EV' || fuelType1 === 'Electricity';
  const hasUsableMpg = !isElectric && Number.isFinite(comb08) && comb08 > 0;
  return VehicleFuelDataSchema.parse({
    mpg: hasUsableMpg ? comb08 : null,
    fuelGrade: mapFuelType(fuelType1),
    isElectric,
  });
}

// These lists only grow once a year (or when a trim's static record is fetched by
// id, which never changes), so there's no reason to ever refetch within a session.
const STATIC_STALE_TIME = Infinity;

export function useVehicleYears() {
  return useQuery({
    queryKey: ['fuel-economy', 'years'],
    queryFn: fetchVehicleYearsRaw,
    staleTime: STATIC_STALE_TIME,
  });
}

export function useVehicleMakes(year: string | null) {
  return useQuery({
    queryKey: ['fuel-economy', 'makes', year],
    queryFn: () => fetchVehicleMakesRaw(year!),
    enabled: !!year,
    staleTime: STATIC_STALE_TIME,
  });
}

export function useVehicleModels(year: string | null, make: string | null) {
  return useQuery({
    queryKey: ['fuel-economy', 'models', year, make],
    queryFn: () => fetchVehicleModelsRaw(year!, make!),
    enabled: !!year && !!make,
    staleTime: STATIC_STALE_TIME,
  });
}

export function useVehicleTrims(year: string | null, make: string | null, model: string | null) {
  return useQuery({
    queryKey: ['fuel-economy', 'trims', year, make, model],
    queryFn: () => fetchVehicleTrimsRaw(year!, make!, model!),
    enabled: !!year && !!make && !!model,
    staleTime: STATIC_STALE_TIME,
  });
}
