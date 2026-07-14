import type { APIRoute } from "astro";
import { put } from "@vercel/blob";
import { AdminUnauthorizedError, redirectUnauthorized, requireAdminSession } from "../../../lib/security/admin-middleware";

export const prerender = false;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"];
const MAX_BYTES = 40 * 1024 * 1024;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    await requireAdminSession(cookies);
  } catch (error) {
    if (error instanceof AdminUnauthorizedError) return redirectUnauthorized();
    throw error;
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const blobToken = import.meta.env.BLOB_READ_WRITE_TOKEN;

  if (!blobToken) {
    return new Response(JSON.stringify({ error: "Falta configurar BLOB_READ_WRITE_TOKEN." }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }

  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: "No se recibio ningun archivo." }), {
      status: 400,
      headers: { "content-type": "application/json" }
    });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return new Response(JSON.stringify({ error: "Solo se permiten imagenes JPG, PNG, WebP, GIF o videos MP4/WebM." }), {
      status: 400,
      headers: { "content-type": "application/json" }
    });
  }

  if (file.size > MAX_BYTES) {
    return new Response(JSON.stringify({ error: "El archivo no puede superar los 40 MB." }), {
      status: 400,
      headers: { "content-type": "application/json" }
    });
  }

  const extensionByType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm"
  };
  const ext = extensionByType[file.type] ?? "bin";
  const filename = `carousel/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  const blob = await put(filename, file, {
    access: "public",
    token: blobToken
  });

  return new Response(JSON.stringify({ url: blob.url, contentType: file.type }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
};
