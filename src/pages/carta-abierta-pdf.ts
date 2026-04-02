import type { APIRoute } from "astro";
import { readFile } from "node:fs/promises";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const pdfUrl = new URL("../../public/assets/carta-abierta-pinguino-humboldt.pdf", import.meta.url);
  const pdf = await readFile(pdfUrl);
  const shouldDownload = url.searchParams.get("download") === "1";

  return new Response(pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${shouldDownload ? "attachment" : "inline"}; filename="carta-abierta-pinguino-humboldt.pdf"`,
      "cache-control": "public, max-age=3600"
    }
  });
};
