import type { APIRoute } from "astro";
import { AdminUnauthorizedError, redirectUnauthorized, requireAdminSession } from "../../../lib/security/admin-middleware";
import { deleteEventSubmission } from "../../../lib/security/events-storage";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    await requireAdminSession(cookies);
  } catch (error) {
    if (error instanceof AdminUnauthorizedError) return redirectUnauthorized();
    throw error;
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
