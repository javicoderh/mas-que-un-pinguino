import type { APIRoute } from "astro";
import { getAdminSessionFromCookies } from "../../../lib/security/admin-auth";
import { securityMessages } from "../../../lib/security/messages";
import { deleteNewsItem } from "../../../lib/security/news-storage";

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
  const id = String(formData.get("news_id") ?? "");

  if (!id) {
    return new Response(null, {
      status: 302,
      headers: {
        location: "/admin?error=invalid_news_id"
      }
    });
  }

  try {
    await deleteNewsItem(id);
    return new Response(null, {
      status: 302,
      headers: {
        location: "/admin?news=delete_ok"
      }
    });
  } catch (error) {
    console.error(error);
    return new Response(null, {
      status: 302,
      headers: {
        location: "/admin?error=news_delete_failed"
      }
    });
  }
};
