import type { APIRoute } from "astro";
import { AdminUnauthorizedError, redirectUnauthorized, requireAdminSession } from "../../../lib/security/admin-middleware";
import { isServerStorageConfigured, securityConfig } from "../../../lib/security/config";
import { queryCollection } from "../../../lib/security/firestore-rest";

export const prerender = false;

interface SignatureExportRow {
  id: string;
  fullName: string;
  country: string;
  region: string;
  commune: string;
  legalNature: string;
  affiliation: string;
  status: string;
  createdAtMs: number;
  source?: { submittedAtMs?: number };
}

const escapeCsvField = (value: unknown): string => {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const msToIso = (ms: number | undefined) =>
  ms ? new Date(ms).toISOString() : "";

export const GET: APIRoute = async ({ cookies, url }) => {
  try {
    await requireAdminSession(cookies);
  } catch (error) {
    if (error instanceof AdminUnauthorizedError) return redirectUnauthorized();
    throw error;
  }

  if (!isServerStorageConfigured) {
    return new Response("config_error", { status: 503 });
  }

  const statusParam = url.searchParams.get("status") ?? "accepted";
  const validStatuses = ["accepted", "flagged", "rejected", "all"];
  if (!validStatuses.includes(statusParam)) {
    return new Response("invalid status", { status: 400 });
  }

  const filters =
    statusParam === "all"
      ? []
      : [{ field: "status", op: "EQUAL", value: statusParam }];

  const rows = await queryCollection<SignatureExportRow>({
    collectionId: securityConfig.collections.signatures,
    filters,
    orderBy: [{ field: "createdAtMs", direction: "DESCENDING" }],
    limit: 5000
  });

  const csvHeader = ["fullName", "country", "region", "commune", "legalNature", "affiliation", "status", "submittedAt"];
  const csvRows = rows.map((row) => [
    escapeCsvField(row.fullName),
    escapeCsvField(row.country),
    escapeCsvField(row.region),
    escapeCsvField(row.commune),
    escapeCsvField(row.legalNature),
    escapeCsvField(row.affiliation),
    escapeCsvField(row.status),
    escapeCsvField(msToIso(row.source?.submittedAtMs ?? row.createdAtMs))
  ]);

  const csv = [csvHeader.join(","), ...csvRows.map((r) => r.join(","))].join("\n");
  const filename = `firmas-${statusParam}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store"
    }
  });
};
