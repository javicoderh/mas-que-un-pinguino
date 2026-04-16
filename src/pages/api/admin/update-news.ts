import type { APIRoute } from "astro";
import { ZodError } from "zod";
import { getAdminSessionFromCookies } from "../../../lib/security/admin-auth";
import { securityMessages } from "../../../lib/security/messages";
import { updateNewsItem } from "../../../lib/security/news-storage";
import { parseNewsUpdatePayload } from "../../../lib/validation/news-schema";

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

  try {
    const formData = await request.formData();
    const id = String(formData.get("news_id") ?? "");

    if (!id) {
      return new Response(null, {
        status: 302,
        headers: {
          location: "/admin?error=invalid_news_id"
        }
      });
    }

    const payload = parseNewsUpdatePayload({
      title: formData.get("title"),
      body: formData.get("body"),
      preference: formData.get("preference"),
      link: formData.get("link") ?? "",
      imageUrl: formData.get("image_url") ?? ""
    });

    await updateNewsItem({
      id,
      ...payload
    });

    return new Response(null, {
      status: 302,
      headers: {
        location: "/admin?news=update_ok"
      }
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return new Response(null, {
        status: 302,
        headers: {
          location: `/admin?error=${encodeURIComponent(error.issues[0]?.message ?? "invalid_news_update")}`
        }
      });
    }

    console.error(error);
    return new Response(null, {
      status: 302,
      headers: {
        location: "/admin?error=news_update_failed"
      }
    });
  }
};
