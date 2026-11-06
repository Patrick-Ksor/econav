import { z } from 'zod';

export const FuelGradeSchema = z.enum(['regular', 'premium', 'diesel']);
export type FuelGrade = z.infer<typeof FuelGradeSchema>;

/** $/mile of value the vehicle loses; part of every trip's cost. */
export const DEFAULT_DEPRECIATION_PER_MILE = 0.18;

export const VehicleProfileSchema = z.object({
  // Required and well-formed: the edit form and the server both validate with this, and an
  // empty string would otherwise count as a valid vehicle.
  year: z.string().regex(/^\d{4}$/, 'Enter a four-digit year'),
  makeModel: z.string().trim().min(1, 'Enter the make and model'),
  mpg: z.number().positive(),
  fuelGrade: FuelGradeSchema,
  gasPriceOverride: z.number().positive().nullable(),
  depreciationPerMile: z.number().min(0).max(5).default(DEFAULT_DEPRECIATION_PER_MILE),
  updatedAt: z.string(),
});
export type VehicleProfile = z.infer<typeof VehicleProfileSchema>;

/** A saved vehicle in the Garage. Exactly one is active; the active one prices every trip. */
export const GarageVehicleSchema = VehicleProfileSchema.extend({
  id: z.string(),
  isActive: z.boolean(),
});
export type GarageVehicle = z.infer<typeof GarageVehicleSchema>;

export const VehicleFormSchema = VehicleProfileSchema.omit({
  gasPriceOverride: true,
  depreciationPerMile: true,
  updatedAt: true,
});
export type VehicleFormValues = z.infer<typeof VehicleFormSchema>;
