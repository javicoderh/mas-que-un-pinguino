import type { APIRoute } from "astro";
import { withPostgres } from "../../../lib/db/postgres";

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const result = await withPostgres(async (sql) => {
      const [row] = await sql`
        select
          count(*)::int as donor_count,
          coalesce(sum(amount), 0)::int as total_amount
        from donations
        where status = 'paid'
      `;
      return row;
    });

    return new Response(
      JSON.stringify({
        ok: true,
        donorCount: result.donor_count,
        totalAmount: result.total_amount,
      }),
      { headers: { "content-type": "application/json; charset=utf-8" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ ok: true, donorCount: 0, totalAmount: 0 }),
      { headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }
};
