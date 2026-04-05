import type { APIRoute } from "astro";
import { campaignConfig } from "../content/campaign";

const publicRoutes = [
  "/",
  "/carta",
  "/firma",
  "/transparencia",
  "/contacto",
  "/privacidad"
];

export const GET: APIRoute = async () => {
  const siteUrl = campaignConfig.site.siteUrl.replace(/\/$/, "");
  const now = new Date().toISOString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${publicRoutes
  .map(
    (route) => `  <url>
    <loc>${siteUrl}${route === "/" ? "/" : route}</loc>
    <lastmod>${now}</lastmod>
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600"
    }
  });
};
