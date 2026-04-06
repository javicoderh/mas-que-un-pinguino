import type { APIRoute } from "astro";
import { getAdminSessionFromCookies } from "../../../lib/security/admin-auth";
import { securityMessages } from "../../../lib/security/messages";
import { deleteEventSubmission } from "../../../lib/security/events-storage";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await getAdminSessionFromCookies(cookies);
  if (!session) {
    return new Response(null, {
      status: 302,
      headers: {
        location: `/admin?error=${encodeURIComponent(securityMessages.adminUnauthorized)}`
      }
    });
  }

  const formData = await request.formData();
  const eventId = String(formData.get("event_id") ?? "");

  if (!eventId) {
    return new Response(null, {
      status: 302,
      headers: {
        location: "/admin?error=invalid_delete"
      }
    });
  }

  try {
    await deleteEventSubmission({ eventId });
    return new Response(null, {
      status: 302,
      headers: {
        location: "/admin?delete=ok"
      }
    });
  } catch (error) {
    console.error(error);
    return new Response(null, {
      status: 302,
      headers: {
        location: "/admin?error=delete_failed"
      }
    });
  }
};
