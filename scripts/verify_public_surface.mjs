import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";

const checks = [];

async function expectFile(path) {
  await access(path);
  checks.push(`OK file ${path}`);
}

async function expectIncludes(path, expected) {
  const content = await readFile(path, "utf8");
  for (const fragment of expected) {
    if (!content.includes(fragment)) {
      throw new Error(`Missing fragment in ${path}: ${fragment}`);
    }
  }
  checks.push(`OK content ${path}`);
}

await expectIncludes("src/pages/robots.txt.ts", [
  "User-agent: *",
  "Disallow: /api/",
  "/sitemap.xml"
]);

await expectIncludes("src/pages/sitemap.xml.ts", [
  "/carta",
  "/firma",
  "/transparencia",
  "/contacto",
  "/privacidad"
]);

await expectIncludes("src/pages/.well-known/security.txt.ts", [
  "Contact: mailto:",
  "/.well-known/security.txt",
  "Preferred-Languages:",
  "Expires:"
]);

await expectIncludes("src/layouts/MainLayout.astro", [
  'meta name="theme-color"',
  'meta property="og:image:alt"',
  'meta name="twitter:image:alt"',
  'application/ld+json',
  'link rel="canonical"'
]);

await expectIncludes("vercel.json", [
  "Strict-Transport-Security",
  "Referrer-Policy",
  "X-Content-Type-Options"
]);

await expectIncludes("src/middleware.ts", [
  "strict-transport-security",
  "x-content-type-options",
  "referrer-policy"
]);

await expectIncludes("src/content/campaign.ts", [
  'publicLetterPdf: "/assets/carta-abierta-pinguino-humboldt.pdf"',
  'contactEmail: "pinguinohumboldtmn@gmail.com"'
]);

await expectFile("PRODUCTION_READINESS_AUDIT.md");
await expectFile("WEBCHECK_IMPROVEMENT_PLAN.md");

console.log(checks.join("\n"));
