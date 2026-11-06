import { getAuthUserId } from '@/server/auth';
import { sql } from '@/server/db';

export async function GET(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) return new Response('Unauthorized', { status: 401 });

  // Aggregated server-side (not derived from the capped 30-row trip list) so
  // lifetime totals stay accurate regardless of how many trips a user has.
  const [totals] = await sql`
    SELECT
      COUNT(*) AS trip_count,
      COALESCE(SUM(savings_dollars), 0) AS total_savings_dollars,
      COALESCE(SUM(savings_gallons), 0) AS total_savings_gallons
    FROM trips WHERE user_id = ${userId}
  `;
  const [monthTotals] = await sql`
    SELECT COALESCE(SUM(savings_dollars), 0) AS month_savings_dollars
    FROM trips
    WHERE user_id = ${userId} AND created_at >= date_trunc('month', now())
  `;

  return Response.json({
    tripCount: Number(totals.trip_count),
    totalSavingsDollars: Number(totals.total_savings_dollars),
    totalSavingsGallons: Number(totals.total_savings_gallons),
    monthSavingsDollars: Number(monthTotals.month_savings_dollars),
  });
}
