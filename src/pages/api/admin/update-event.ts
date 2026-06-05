import type { APIRoute } from "astro";
import { AdminUnauthorizedError, redirectUnauthorized, requireAdminSession } from "../../../lib/security/admin-middleware";
import { updateEvent } from "../../../lib/security/events-storage";
import { chileRegions, normalizeRegionKey } from "../../../lib/events/chile-regions";

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
  const eventId       = String(formData.get("event_id")        ?? "").trim();
  const title         = String(formData.get("title")           ?? "").trim();
  const description   = String(formData.get("description")     ?? "").trim();
  const imageUrl      = String(formData.get("image_url")       ?? "").trim();
  const link          = String(formData.get("link")            ?? "").trim();
  const date          = String(formData.get("date")            ?? "").trim();
  const time          = String(formData.get("time")            ?? "").trim();
  const regionRaw     = String(formData.get("region")          ?? "").trim();
  const venue         = String(formData.get("venue")           ?? "").trim();
  const organizerName = String(formData.get("organizer_name")  ?? "").trim();
  const organizerEmail= String(formData.get("organizer_email") ?? "").trim();

  const matchedRegion = chileRegions.find(
    (r) => normalizeRegionKey(r.name) === normalizeRegionKey(regionRaw)
  );

  const invalid =
    !eventId ||
    !title ||
    !description ||
    !httpUrlPattern.test(imageUrl) ||
    (link !== "" && !httpUrlPattern.test(link)) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^\d{2}:\d{2}$/.test(time) ||
    !matchedRegion ||
    !venue;

  if (invalid) {
    return new Response(null, { status: 302, headers: { location: "/admin?error=invalid_event_update" } });
  }

  try {
    await updateEvent({
      eventId,
      title,
      description,
      imageUrl,
      link,
      date,
      time,
      region: matchedRegion.name,
      regionKey: normalizeRegionKey(matchedRegion.name),
      venue,
      organizerName,
      organizerEmail
    });
    return new Response(null, { status: 302, headers: { location: "/admin?event_update=ok" } });
  } catch (error) {
    console.error(error);
    return new Response(null, { status: 302, headers: { location: "/admin?error=event_update_failed" } });
  }
};
