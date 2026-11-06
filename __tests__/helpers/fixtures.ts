import type { TripHistoryEntry } from '@/schemas/routing';
import type { GarageVehicle } from '@/schemas/vehicle';

/** 2024 Camry, 24 MPG, a custom $3.60 gas price so cost-per-mile never depends on live pricing. */
export const CAMRY: GarageVehicle = {
  id: 'veh_camry',
  year: '2024',
  makeModel: 'Toyota Camry LE/SE',
  mpg: 24,
  fuelGrade: 'regular',
  gasPriceOverride: 3.6,
  depreciationPerMile: 0.18,
  isActive: true,
  updatedAt: '2026-11-05T12:00:00.000Z',
};

export const CIVIC: GarageVehicle = {
  id: 'veh_civic',
  year: '2019',
  makeModel: 'Honda Civic EX',
  mpg: 36,
  fuelGrade: 'regular',
  gasPriceOverride: 3.6,
  depreciationPerMile: 0.12,
  isActive: false,
  updatedAt: '2026-10-01T12:00:00.000Z',
};

export const trip = (overrides: Partial<TripHistoryEntry> = {}): TripHistoryEntry => ({
  id: 'trip_1',
  destinationLabel: 'Greenway Market',
  distanceMiles: 8.2,
  estimatedCost: 2.38,
  createdAt: new Date(2026, 9, 26, 17, 40).toISOString(),
  savingsDollars: 1.16,
  savingsGallons: 0.3,
  ...overrides,
});
