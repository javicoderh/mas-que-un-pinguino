import type { APIRoute } from "astro";
import { getAdminSessionFromCookies } from "../../../lib/security/admin-auth";
import { securityMessages } from "../../../lib/security/messages";
import { reviewEventSubmission } from "../../../lib/security/events-storage";

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
