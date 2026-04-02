import type { APIRoute } from "astro";
import { getPublicSignatureCount } from "../../../lib/security/storage";

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const count = await getPublicSignatureCount();
    return new Response(JSON.stringify({ count }), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=60"
      }
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ count: 0 }), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8"
      }
    });
  }
};
