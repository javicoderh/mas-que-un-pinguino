import type { APIRoute } from "astro";
import { campaignConfig } from "../content/campaign";

const publicRoutes = [
  { route: "/", lastmod: "2026-04-06", changefreq: "daily", priority: "1.0" },
  { route: "/carta", lastmod: "2026-04-06", changefreq: "weekly", priority: "0.9" },
  { route: "/firma", lastmod: "2026-04-06", changefreq: "weekly", priority: "0.9" },
  { route: "/eventos", lastmod: "2026-04-06", changefreq: "daily", priority: "0.9" },
  { route: "/eventos/proponer", lastmod: "2026-04-06", changefreq: "weekly", priority: "0.7" },
  { route: "/ciencia", lastmod: "2026-04-06", changefreq: "weekly", priority: "0.85" },
  { route: "/pinguino-de-humboldt", lastmod: "2026-04-06", changefreq: "monthly", priority: "0.8" },
  { route: "/monumento-natural-pinguino-de-humboldt", lastmod: "2026-04-06", changefreq: "monthly", priority: "0.8" },
  { route: "/amenazas", lastmod: "2026-04-06", changefreq: "monthly", priority: "0.8" },
  { route: "/faq", lastmod: "2026-04-06", changefreq: "weekly", priority: "0.75" },
  { route: "/noticias", lastmod: "2026-04-06", changefreq: "weekly", priority: "0.75" },
  { route: "/transparencia", lastmod: "2026-04-06", changefreq: "monthly", priority: "0.6" },
  { route: "/contacto", lastmod: "2026-04-06", changefreq: "monthly", priority: "0.5" },
  { route: "/privacidad", lastmod: "2026-04-06", changefreq: "yearly", priority: "0.3" }
] as const;

export const GET: APIRoute = async () => {
  const siteUrl = campaignConfig.site.siteUrl.replace(/\/$/, "");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${publicRoutes
  .map(
    ({ route, lastmod, changefreq, priority }) => `  <url>
    <loc>${siteUrl}${route === "/" ? "/" : route}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
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
