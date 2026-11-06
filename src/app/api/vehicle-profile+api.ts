import { getAuthUserId } from '@/server/auth';
import { sql } from '@/server/db';
import { rowToVehicle } from '@/server/vehicles';
import { VehicleProfileSchema } from '@/schemas/vehicle';

/** The user's active vehicle — the one every trip is priced with. */
export async function GET(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const rows = await sql`
    SELECT id, year, make_model, mpg, fuel_grade, gas_price_override, depreciation_per_mile, is_active, updated_at
    FROM garage_vehicles WHERE user_id = ${userId} AND is_active
  `;
  const row = rows[0];
  if (!row) return Response.json(null);

  return Response.json(rowToVehicle(row));
}

/** Edits the active vehicle in place. If the user has none yet, creates one as active. */
export async function PUT(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const body = VehicleProfileSchema.parse(await request.json());

  const updated = await sql`
    UPDATE garage_vehicles SET
      year = ${body.year},
      make_model = ${body.makeModel},
      mpg = ${body.mpg},
      fuel_grade = ${body.fuelGrade},
      gas_price_override = ${body.gasPriceOverride},
      depreciation_per_mile = ${body.depreciationPerMile},
      updated_at = ${body.updatedAt}
    WHERE user_id = ${userId} AND is_active
    RETURNING id
  `;

  if (updated.length === 0) {
    await sql`
      INSERT INTO garage_vehicles (id, user_id, year, make_model, mpg, fuel_grade, gas_price_override, depreciation_per_mile, is_active, updated_at)
      VALUES (${`veh_${crypto.randomUUID()}`}, ${userId}, ${body.year}, ${body.makeModel}, ${body.mpg}, ${body.fuelGrade}, ${body.gasPriceOverride}, ${body.depreciationPerMile}, true, ${body.updatedAt})
    `;
  }

  return Response.json(body);
}
