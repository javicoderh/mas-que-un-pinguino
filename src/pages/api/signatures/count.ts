import type { APIRoute } from "astro";
import {
  emergencySignatureCounterFallback,
  getCachedPublicSignatureBreakdown
} from "../../../lib/security/storage";

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const payload = await getCachedPublicSignatureBreakdown();
    return new Response(JSON.stringify(payload), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=600, s-maxage=600"
      }
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify(emergencySignatureCounterFallback), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=600, s-maxage=600"
      }
    });
  }
};
