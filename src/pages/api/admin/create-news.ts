import type { APIRoute } from "astro";
import { ZodError } from "zod";
import { getAdminSessionFromCookies } from "../../../lib/security/admin-auth";
import { securityMessages } from "../../../lib/security/messages";
import { createNewsItem } from "../../../lib/security/news-storage";
import { parseNewsCreatePayload } from "../../../lib/validation/news-schema";

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
    const payload = parseNewsCreatePayload({
      title: formData.get("title"),
      body: formData.get("body"),
      link: formData.get("link") ?? "",
      imageUrl: formData.get("image_url") ?? ""
    });

    await createNewsItem(payload);
    return new Response(null, {
      status: 302,
      headers: {
        location: "/admin?news=create_ok"
      }
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return new Response(null, {
        status: 302,
        headers: {
          location: `/admin?error=${encodeURIComponent(error.issues[0]?.message ?? "invalid_news")}`
        }
      });
    }

    console.error(error);
    return new Response(null, {
      status: 302,
      headers: {
        location: "/admin?error=news_create_failed"
      }
    });
  }
};
