import type { APIRoute } from "astro";
import { campaignConfig } from "../../content/campaign";

const body = `Contact: mailto:${campaignConfig.site.contactEmail}
Canonical: ${campaignConfig.site.siteUrl}/.well-known/security.txt
Preferred-Languages: es, en
Expires: 2027-04-05T00:00:00Z
`;

export const GET: APIRoute = async () =>
  new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600"
    }
  });
