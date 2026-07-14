import type { APIRoute } from "astro";
import { getAdminSessionFromCookies } from "../../../lib/security/admin-auth";
import { deleteCarouselItem } from "../../../lib/security/carousel-storage";
import { securityMessages } from "../../../lib/security/messages";

export const prerender = false;

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

    await deleteCarouselItem(id);
    return new Response(null, {
      status: 302,
      headers: { location: "/admin?carousel=delete_ok" }
    });
  } catch (error) {
    console.error(error);
    return new Response(null, {
      status: 302,
      headers: { location: "/admin?error=carousel_delete_failed" }
    });
  }
};
