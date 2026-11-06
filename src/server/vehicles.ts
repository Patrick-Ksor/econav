import type { GarageVehicle } from '@/schemas/vehicle';

type Row = Record<string, unknown>;

export const VEHICLE_COLUMNS =
  'id, year, make_model, mpg, fuel_grade, gas_price_override, depreciation_per_mile, is_active, updated_at';

/** Maps a garage_vehicles row to the API shape (numerics arrive from Postgres as strings). */
export function rowToVehicle(row: Row): GarageVehicle {
  return {
    id: row.id as string,
    year: row.year as string,
    makeModel: row.make_model as string,
    mpg: Number(row.mpg),
    fuelGrade: row.fuel_grade as GarageVehicle['fuelGrade'],
    gasPriceOverride: row.gas_price_override != null ? Number(row.gas_price_override) : null,
    depreciationPerMile: Number(row.depreciation_per_mile),
    isActive: row.is_active as boolean,
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}
