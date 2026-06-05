import { withPostgres } from "./postgres";

export interface DonationRow {
  id: string;
  flow_order: string | null;
  flow_token: string | null;
  donor_name: string;
  email: string;
  amount: number;
  currency: string;
  language: string;
  status: string;
  receipt_number: string | null;
  paid_at_ms: number | null;
  created_at_ms: number;
}

export interface DonationStats {
  total_clp: number;
  total_usd: number;
  paid_count: number;
  pending_count: number;
  missing_receipt_count: number;
}

export interface ListDonationsResult {
  rows: DonationRow[];
  stats: DonationStats;
  total_rows: number;
}

export async function listDonations(params: {
  fromMs?: number;
  toMs?: number;
  search?: string;
  page: number;
  pageSize: number;
}): Promise<ListDonationsResult> {
  return withPostgres(async (sql) => {
    const { fromMs, toMs, search, page, pageSize } = params;
    const offset = (page - 1) * pageSize;

    // Build dynamic WHERE clauses
    const conditions: string[] = [];
    if (fromMs !== undefined) conditions.push(`created_at_ms >= ${fromMs}`);
    if (toMs !== undefined) conditions.push(`created_at_ms <= ${toMs}`);
    if (search) {
      const s = search.replace(/'/g, "''");
      conditions.push(
        `(donor_name ilike '%${s}%' or email ilike '%${s}%' or receipt_number ilike '%${s}%' or flow_order ilike '%${s}%' or flow_token ilike '%${s}%')`
      );
    }
    const where = conditions.length ? `where ${conditions.join(" and ")}` : "";

    const [statsRow] = await sql.unsafe(`
      select
        coalesce(sum(case when status = 'paid' and currency = 'CLP' then amount else 0 end), 0)::int as total_clp,
        coalesce(sum(case when status = 'paid' and currency = 'USD' then amount else 0 end), 0)::int as total_usd,
        count(case when status = 'paid' then 1 end)::int as paid_count,
        count(case when status = 'pending' then 1 end)::int as pending_count,
        count(case when status = 'paid' and receipt_number is null then 1 end)::int as missing_receipt_count
      from donations
      ${where}
    `);

    const [countRow] = await sql.unsafe(`
      select count(*)::int as total from donations ${where}
    `);

    const rows = await sql.unsafe(`
      select id, flow_order, flow_token, donor_name, email, amount, currency, language,
             status, receipt_number, paid_at_ms, created_at_ms
      from donations
      ${where}
      order by created_at_ms desc
      limit ${pageSize} offset ${offset}
    `);

    return {
      rows: rows as unknown as DonationRow[],
      stats: {
        total_clp: Number(statsRow.total_clp),
        total_usd: Number(statsRow.total_usd),
        paid_count: Number(statsRow.paid_count),
        pending_count: Number(statsRow.pending_count),
        missing_receipt_count: Number(statsRow.missing_receipt_count),
      },
      total_rows: Number(countRow.total),
    };
  });
}
