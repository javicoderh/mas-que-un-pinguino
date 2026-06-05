import type { APIRoute } from "astro";
import { clearAdminSessionCookie } from "../../../lib/security/admin-auth";

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  clearAdminSessionCookie(cookies);
  return new Response(null, {
    status: 302,
    headers: {
      location: "/admin"
    }
  });
};
