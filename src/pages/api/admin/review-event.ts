import type { APIRoute } from "astro";
import { AdminUnauthorizedError, redirectUnauthorized, requireAdminSession } from "../../../lib/security/admin-middleware";
import { reviewEventSubmission } from "../../../lib/security/events-storage";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  let session;
  try {
    session = await requireAdminSession(cookies);
  } catch (error) {
    if (error instanceof AdminUnauthorizedError) return redirectUnauthorized();
    throw error;
  }

  const formData = await request.formData();
  const eventId = String(formData.get("event_id") ?? "");
  const decision = String(formData.get("decision") ?? "");

  if (!eventId || !["approved", "rejected"].includes(decision)) {
    return new Response(null, {
      status: 302,
      headers: {
        location: "/admin?error=invalid_review"
      }
    });
  }

  try {
    await reviewEventSubmission({
      eventId,
      decision: decision as "approved" | "rejected",
      reviewer: session.username
    });

    return new Response(null, {
      status: 302,
      headers: {
        location: "/admin?review=ok"
      }
    });
  } catch (error) {
    console.error(error);
    return new Response(null, {
      status: 302,
      headers: {
        location: "/admin?error=review_failed"
      }
    });
  }
};
