import type { APIRoute } from "astro";
import { getAdminSessionFromCookies } from "../../../lib/security/admin-auth";
import { securityMessages } from "../../../lib/security/messages";
import { updateCarouselItem, type CarouselItemType } from "../../../lib/security/carousel-storage";

export const prerender = false;

const parseActive = (value: FormDataEntryValue | null) => value === "on" || value === "true" || value === "1";

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await getAdminSessionFromCookies(cookies);
  if (!session) {
    return new Response(null, {
      status: 302,
      headers: { location: `/admin?error=${encodeURIComponent(securityMessages.adminUnauthorized)}` }
    });
  }

  try {
    const formData = await request.formData();
    const id = String(formData.get("carousel_id") ?? "");
    if (!id) throw new Error("invalid_carousel_id");

    await updateCarouselItem(id, {
      type: String(formData.get("type") ?? "image") as CarouselItemType,
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      mediaUrl: String(formData.get("media_url") ?? ""),
      eventId: String(formData.get("event_id") ?? ""),
      sortOrder: Number(formData.get("sort_order") ?? "0"),
      isActive: parseActive(formData.get("is_active"))
    });

    return new Response(null, {
      status: 302,
      headers: { location: "/admin?carousel=update_ok" }
    });
  } catch (error) {
    console.error(error);
    return new Response(null, {
      status: 302,
      headers: { location: `/admin?error=${encodeURIComponent(error instanceof Error ? error.message : "carousel_update_failed")}` }
    });
  }
};
