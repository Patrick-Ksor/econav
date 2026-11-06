import { getAuthUserId } from '@/server/auth';
import { sql } from '@/server/db';

export async function DELETE(request: Request, { id }: Record<string, string>) {
  const userId = await getAuthUserId(request);
  if (!userId) return new Response('Unauthorized', { status: 401 });

  // Scoped by user_id too — not just the trip id — so one user can never delete
  // another's trip even if they guessed or intercepted its id.
  await sql`DELETE FROM trips WHERE id = ${id} AND user_id = ${userId}`;

  return new Response(null, { status: 204 });
}
