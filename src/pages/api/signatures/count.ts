import type { APIRoute } from "astro";
import { getPublicSignatureBreakdown } from "../../../lib/security/storage";

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const payload = await getPublicSignatureBreakdown();
    return new Response(JSON.stringify(payload), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=60"
      }
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ count: 0, chileanCount: 0, foreignCount: 0 }), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }
};
