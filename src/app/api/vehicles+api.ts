import { z } from 'zod';

import { getAuthUserId } from '@/server/auth';
import { sql } from '@/server/db';
import { rowToVehicle } from '@/server/vehicles';
import { VehicleProfileSchema } from '@/schemas/vehicle';

const NewVehicleSchema = VehicleProfileSchema.extend({ id: z.string().min(1).max(100) });

/** Every vehicle in the user's garage, active one first. */
export async function GET(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const rows = await sql`
    SELECT id, year, make_model, mpg, fuel_grade, gas_price_override, depreciation_per_mile, is_active, updated_at
    FROM garage_vehicles WHERE user_id = ${userId}
    ORDER BY is_active DESC, updated_at DESC
  `;
  return Response.json(rows.map(rowToVehicle));
}

/** Adds a vehicle and makes it the active one. Existing vehicles are kept. */
export async function POST(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const body = NewVehicleSchema.parse(await request.json());

  // One transaction so the user is never left with two active vehicles, or none.
  await sql.transaction([
    sql`UPDATE garage_vehicles SET is_active = false WHERE user_id = ${userId} AND is_active`,
    sql`
      INSERT INTO garage_vehicles (id, user_id, year, make_model, mpg, fuel_grade, gas_price_override, depreciation_per_mile, is_active, updated_at)
      VALUES (${body.id}, ${userId}, ${body.year}, ${body.makeModel}, ${body.mpg}, ${body.fuelGrade}, ${body.gasPriceOverride}, ${body.depreciationPerMile}, true, ${body.updatedAt})
    `,
  ]);

  return Response.json({ ...body, isActive: true });
}
