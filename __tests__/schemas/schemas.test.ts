import { DEFAULT_ROUTE_PREFERENCES, RoutePreferencesSchema } from '@/schemas/route-preferences';
import { TripHistoryEntrySchema } from '@/schemas/routing';
import {
  DEFAULT_DEPRECIATION_PER_MILE,
  FuelGradeSchema,
  GarageVehicleSchema,
  VehicleFormSchema,
  VehicleProfileSchema,
} from '@/schemas/vehicle';

const vehicle = {
  year: '2021',
  makeModel: 'Toyota RAV4',
  mpg: 30,
  fuelGrade: 'regular',
  gasPriceOverride: null,
  updatedAt: '2026-11-05T12:00:00.000Z',
};

describe('VehicleProfileSchema', () => {
  test('accepts a valid vehicle and defaults depreciation to $0.18/mi', () => {
    const parsed = VehicleProfileSchema.parse(vehicle);
    expect(parsed.depreciationPerMile).toBe(DEFAULT_DEPRECIATION_PER_MILE);
    expect(DEFAULT_DEPRECIATION_PER_MILE).toBe(0.18);
  });

  test('keeps an explicit depreciation, including zero', () => {
    expect(VehicleProfileSchema.parse({ ...vehicle, depreciationPerMile: 0 }).depreciationPerMile).toBe(0);
    expect(VehicleProfileSchema.parse({ ...vehicle, depreciationPerMile: 0.24 }).depreciationPerMile).toBe(0.24);
  });

  test.each([-0.01, 5.01, 100])('rejects depreciation of %p', (depreciationPerMile) => {
    expect(VehicleProfileSchema.safeParse({ ...vehicle, depreciationPerMile }).success).toBe(false);
  });

  test.each([0, -5])('rejects an MPG of %p', (mpg) => {
    expect(VehicleProfileSchema.safeParse({ ...vehicle, mpg }).success).toBe(false);
  });

  test('allows a custom gas price but not a zero or negative one', () => {
    expect(VehicleProfileSchema.safeParse({ ...vehicle, gasPriceOverride: 3.49 }).success).toBe(true);
    expect(VehicleProfileSchema.safeParse({ ...vehicle, gasPriceOverride: 0 }).success).toBe(false);
  });

  test.each([['', 'empty'], ['21', 'two digits'], ['20211', 'five digits'], ['abcd', 'non-numeric']])(
    'rejects a year of %p (%s)',
    (year) => {
      expect(VehicleProfileSchema.safeParse({ ...vehicle, year }).success).toBe(false);
    },
  );

  test.each(['', '   '])('rejects a blank make and model (%p)', (makeModel) => {
    expect(VehicleProfileSchema.safeParse({ ...vehicle, makeModel }).success).toBe(false);
  });

  test('trims stray whitespace around the make and model', () => {
    expect(VehicleProfileSchema.parse({ ...vehicle, makeModel: '  Toyota RAV4 ' }).makeModel).toBe('Toyota RAV4');
  });

  test('rejects an unknown fuel grade', () => {
    expect(VehicleProfileSchema.safeParse({ ...vehicle, fuelGrade: 'electric' }).success).toBe(false);
  });
});

describe('GarageVehicleSchema', () => {
  test('adds an id and active flag to a vehicle', () => {
    const parsed = GarageVehicleSchema.parse({ ...vehicle, id: 'veh_1', isActive: true });
    expect(parsed.id).toBe('veh_1');
    expect(parsed.isActive).toBe(true);
  });

  test('requires both', () => {
    expect(GarageVehicleSchema.safeParse(vehicle).success).toBe(false);
    expect(GarageVehicleSchema.safeParse({ ...vehicle, id: 'veh_1' }).success).toBe(false);
  });
});

describe('VehicleFormSchema', () => {
  test('covers only what the edit form collects', () => {
    const parsed = VehicleFormSchema.parse({ year: '2021', makeModel: 'Toyota RAV4', mpg: 30, fuelGrade: 'premium' });
    expect(Object.keys(parsed).sort()).toEqual(['fuelGrade', 'makeModel', 'mpg', 'year']);
  });
});

describe('FuelGradeSchema', () => {
  test.each(['regular', 'premium', 'diesel'])('accepts %s', (grade) => {
    expect(FuelGradeSchema.safeParse(grade).success).toBe(true);
  });

  test('rejects anything else', () => {
    expect(FuelGradeSchema.safeParse('ethanol').success).toBe(false);
  });
});

describe('RoutePreferencesSchema', () => {
  test('the defaults are valid', () => {
    expect(RoutePreferencesSchema.safeParse(DEFAULT_ROUTE_PREFERENCES).success).toBe(true);
  });

  test('defaults match the handoff: balance, $18/hr, tolls on', () => {
    expect(DEFAULT_ROUTE_PREFERENCES).toEqual({ priority: 'balance', timeValuePerHour: 18, includeTolls: true });
  });

  test.each([0, 50, 100])('accepts a time value of $%p/hr', (timeValuePerHour) => {
    expect(RoutePreferencesSchema.safeParse({ ...DEFAULT_ROUTE_PREFERENCES, timeValuePerHour }).success).toBe(true);
  });

  test.each([-1, 101])('rejects a time value of $%p/hr', (timeValuePerHour) => {
    expect(RoutePreferencesSchema.safeParse({ ...DEFAULT_ROUTE_PREFERENCES, timeValuePerHour }).success).toBe(false);
  });

  test('rejects an unknown priority', () => {
    expect(RoutePreferencesSchema.safeParse({ ...DEFAULT_ROUTE_PREFERENCES, priority: 'cheapest' }).success).toBe(false);
  });

  test('depreciation lives on the vehicle now, not here', () => {
    const parsed = RoutePreferencesSchema.parse({ ...DEFAULT_ROUTE_PREFERENCES, depreciationPerMile: 0.5 });
    expect('depreciationPerMile' in parsed).toBe(false);
  });
});

describe('TripHistoryEntrySchema', () => {
  const entry = {
    id: 't1',
    destinationLabel: 'Greenway Market',
    distanceMiles: 8.2,
    estimatedCost: 2.38,
    createdAt: '2026-10-26T17:40:00.000Z',
  };

  test('older trips without savings fields still parse', () => {
    expect(TripHistoryEntrySchema.safeParse(entry).success).toBe(true);
  });

  test('savings may be null, positive or negative', () => {
    for (const savingsDollars of [null, 1.16, -0.85]) {
      expect(TripHistoryEntrySchema.safeParse({ ...entry, savingsDollars }).success).toBe(true);
    }
  });
});
