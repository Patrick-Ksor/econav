import { getAuthUserId } from '@/server/auth';
import { sql } from '@/server/db';

async function ownsVehicle(userId: string, id: string): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM garage_vehicles WHERE id = ${id} AND user_id = ${userId}`;
  return rows.length > 0;
}

/** Makes this vehicle the active one ("Use this car"). */
export async function PATCH(request: Request, { id }: Record<string, string>) {
  const userId = await getAuthUserId(request);
  if (!userId) return new Response('Unauthorized', { status: 401 });
  // Checked up front: the transaction below deactivates everything first, so an id
  // that isn't theirs must be rejected before it could leave the user with no active car.
  if (!(await ownsVehicle(userId, id))) return new Response('Not found', { status: 404 });

  await sql.transaction([
    sql`UPDATE garage_vehicles SET is_active = false WHERE user_id = ${userId} AND is_active`,
    sql`UPDATE garage_vehicles SET is_active = true, updated_at = now() WHERE id = ${id} AND user_id = ${userId}`,
  ]);

  return new Response(null, { status: 204 });
}

/** Removes a vehicle. If it was the active one, the most recently used remaining one takes over. */
export async function DELETE(request: Request, { id }: Record<string, string>) {
  const userId = await getAuthUserId(request);
  if (!userId) return new Response('Unauthorized', { status: 401 });
  if (!(await ownsVehicle(userId, id))) return new Response('Not found', { status: 404 });

  await sql.transaction([
    sql`DELETE FROM garage_vehicles WHERE id = ${id} AND user_id = ${userId}`,
    sql`
      UPDATE garage_vehicles SET is_active = true
      WHERE id = (SELECT id FROM garage_vehicles WHERE user_id = ${userId} ORDER BY updated_at DESC LIMIT 1)
        AND NOT EXISTS (SELECT 1 FROM garage_vehicles WHERE user_id = ${userId} AND is_active)
    `,
  ]);

  return new Response(null, { status: 204 });
}
