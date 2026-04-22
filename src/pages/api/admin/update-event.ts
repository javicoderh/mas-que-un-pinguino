import type { APIRoute } from "astro";
import { AdminUnauthorizedError, redirectUnauthorized, requireAdminSession } from "../../../lib/security/admin-middleware";
import { updateEventMedia } from "../../../lib/security/events-storage";

export const prerender = false;

const httpUrlPattern = /^https?:\/\/.{4,}/i;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    await requireAdminSession(cookies);
  } catch (error) {
    if (error instanceof AdminUnauthorizedError) return redirectUnauthorized();
    throw error;
  }

  const formData = await request.formData();
  const eventId = String(formData.get("event_id") ?? "").trim();
  const imageUrl = String(formData.get("image_url") ?? "").trim();
  const link = String(formData.get("link") ?? "").trim();

  if (!eventId || !httpUrlPattern.test(imageUrl) || (link !== "" && !httpUrlPattern.test(link))) {
    return new Response(null, {
      status: 302,
      headers: {
        location: "/admin?error=invalid_event_update"
      }
    });
  }

  try {
    await updateEventMedia({ eventId, imageUrl, link });
    return new Response(null, {
      status: 302,
      headers: {
        location: "/admin?event_update=ok"
      }
    });
  } catch (error) {
    console.error(error);
    return new Response(null, {
      status: 302,
      headers: {
        location: "/admin?error=event_update_failed"
      }
    });
  }
};
