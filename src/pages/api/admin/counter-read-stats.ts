import type { APIRoute } from "astro";
import { AdminUnauthorizedError, redirectUnauthorized, requireAdminSession } from "../../../lib/security/admin-middleware";
import { getPublicCounterReadStats } from "../../../lib/security/storage";

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  try {
    await requireAdminSession(cookies);
  } catch (error) {
    if (error instanceof AdminUnauthorizedError) return redirectUnauthorized();
    throw error;
  }

  const stats = await getPublicCounterReadStats();
  return new Response(JSON.stringify(stats), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
};
