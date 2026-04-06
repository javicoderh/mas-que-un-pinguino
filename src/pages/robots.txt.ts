import type { APIRoute } from "astro";
import { campaignConfig } from "../content/campaign";

const body = `User-agent: *
Allow: /
Disallow: /api/

Host: ${campaignConfig.site.siteUrl}
Sitemap: ${campaignConfig.site.siteUrl}/sitemap.xml
Sitemap: ${campaignConfig.site.siteUrl}/sitemap-index.xml
`;

export const GET: APIRoute = async () =>
  new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600"
    }
  });
