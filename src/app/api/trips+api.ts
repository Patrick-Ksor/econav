import { getAuthUserId } from '@/server/auth';
import { sql } from '@/server/db';
import { TripHistoryEntrySchema } from '@/schemas/routing';

export async function GET(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const rows = await sql`
    SELECT id, destination_label, distance_miles, estimated_cost, created_at, savings_dollars, savings_gallons
    FROM trips WHERE user_id = ${userId}
    ORDER BY created_at DESC LIMIT 30
  `;

  return Response.json(
    rows.map((row) => ({
      id: row.id,
      destinationLabel: row.destination_label,
      distanceMiles: Number(row.distance_miles),
      estimatedCost: Number(row.estimated_cost),
      createdAt: row.created_at,
      savingsDollars: row.savings_dollars != null ? Number(row.savings_dollars) : null,
      savingsGallons: row.savings_gallons != null ? Number(row.savings_gallons) : null,
    })),
  );
}

export async function POST(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const body = TripHistoryEntrySchema.parse(await request.json());

  await sql`
    INSERT INTO trips (id, user_id, destination_label, distance_miles, estimated_cost, created_at, savings_dollars, savings_gallons)
    VALUES (${body.id}, ${userId}, ${body.destinationLabel}, ${body.distanceMiles}, ${body.estimatedCost}, ${body.createdAt}, ${body.savingsDollars ?? null}, ${body.savingsGallons ?? null})
  `;

  return Response.json(body);
}
