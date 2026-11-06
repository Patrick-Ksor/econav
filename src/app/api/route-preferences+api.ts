import { getAuthUserId } from '@/server/auth';
import { sql } from '@/server/db';
import { DEFAULT_ROUTE_PREFERENCES, RoutePreferencesSchema } from '@/schemas/route-preferences';

export async function GET(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const rows = await sql`
    SELECT priority, time_value_per_hour, include_tolls
    FROM route_preferences WHERE user_id = ${userId}
  `;
  const row = rows[0];
  // No row yet means the user never saved preferences — serve the defaults.
  if (!row) return Response.json(DEFAULT_ROUTE_PREFERENCES);

  return Response.json({
    priority: row.priority,
    timeValuePerHour: Number(row.time_value_per_hour),
    includeTolls: row.include_tolls,
  });
}

export async function PUT(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const body = RoutePreferencesSchema.parse(await request.json());

  await sql`
    INSERT INTO route_preferences (user_id, priority, time_value_per_hour, include_tolls, updated_at)
    VALUES (${userId}, ${body.priority}, ${body.timeValuePerHour}, ${body.includeTolls}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      priority = EXCLUDED.priority,
      time_value_per_hour = EXCLUDED.time_value_per_hour,
      include_tolls = EXCLUDED.include_tolls,
      updated_at = EXCLUDED.updated_at
  `;

  return Response.json(body);
}
