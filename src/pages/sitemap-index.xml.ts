import type { APIRoute } from "astro";

export const GET: APIRoute = async () =>
  Response.redirect("/sitemap.xml", 301);
