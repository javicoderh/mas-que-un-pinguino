import type { APIRoute } from "astro";
import { z, ZodError } from "zod";
import { isSecurityConfigured, isServerStorageConfigured, securityConfig } from "../../../lib/security/config";
import { verifyFormToken } from "../../../lib/security/form-token";
import { hashWithSecret } from "../../../lib/security/hash";
import { getClientIp, isAllowedOrigin } from "../../../lib/security/request";
import { enforceRateLimit } from "../../../lib/security/rate-limit";
import { withPostgres, isUniqueViolation } from "../../../lib/db/postgres";
import type { RateLimitRule } from "../../../lib/security/config";
import { bumpForeignSignatureCounterCache } from "../../../lib/security/storage";

export const prerender = false;

const foreignSignatureSchema = z.object({
  name: z.string().min(2).max(120),
  country: z.string().min(2).max(80),
  reason: z.string().min(5).max(600),
  email: z.string().email(),
  consent: z.literal(true)
});

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });

export const POST: APIRoute = async ({ request, url }) => {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  if (!isSecurityConfigured || !isServerStorageConfigured) {
    return jsonResponse(503, { ok: false, message: "El servicio no está disponible en este momento." });
  }

  if (!isAllowedOrigin(request)) {
    return jsonResponse(403, { ok: false, message: "Origen no permitido." });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data") && !contentType.includes("application/x-www-form-urlencoded")) {
    return jsonResponse(415, { ok: false, message: "Formato no soportado." });
  }

  const ip = getClientIp(request.headers);
  const ipHash = await hashWithSecret(securityConfig.hashSecret, "ip", ip);

  const foreignRateLimitRules: RateLimitRule[] = [
    { name: "window", windowMs: 60 * 60 * 1000, maxHits: 5 }
  ];

  const ipRateLimit = await enforceRateLimit(
    "foreign_signature_post_ip",
    ipHash,
    foreignRateLimitRules,
    { route: url.pathname, action: "foreign_signature_post" }
  );

  if (!ipRateLimit.allowed) {
    return jsonResponse(429, { ok: false, message: "Demasiados intentos. Intenta nuevamente más tarde." });
  }

  const formData = await request.formData();
  const issuedAtMs = Number(formData.get("issued_at_ms") ?? "0");
  const nonce = String(formData.get("form_nonce") ?? "");
  const token = String(formData.get("form_token") ?? "");

  const tokenValid =
    Number.isFinite(issuedAtMs) &&
    nonce.length > 0 &&
    token.length > 0 &&
    (await verifyFormToken({ issuedAtMs, nonce, intent: "foreign_signature_submit" }, token));

  if (!tokenValid || Date.now() - issuedAtMs > securityConfig.maxTokenAgeMs) {
    return jsonResponse(400, { ok: false, message: "Formulario inválido o expirado. Recarga la página." });
  }

  try {
    const parsed = foreignSignatureSchema.parse({
      name: String(formData.get("name") ?? "").trim(),
      country: String(formData.get("country") ?? "").trim(),
      reason: String(formData.get("reason") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      consent: formData.get("consent") === "on" ? true : undefined
    });

    const emailHash = await hashWithSecret(securityConfig.hashSecret, "foreign_email", parsed.email);
    const now = Date.now();

    await withPostgres(async (sql) => {
      await sql`
        insert into foreign_signatures (id, name, country, reason, email, email_hash, status, source_ip_hash, created_at_ms, updated_at_ms)
        values (
          ${crypto.randomUUID()},
          ${parsed.name},
          ${parsed.country},
          ${parsed.reason},
          ${parsed.email},
          ${emailHash},
          ${"accepted"},
          ${ipHash},
          ${now},
          ${now}
        )
      `;
    });

    bumpForeignSignatureCounterCache();

    return jsonResponse(200, {
      ok: true,
      message: "¡Gracias por tu apoyo! Your signature has been registered."
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return jsonResponse(409, {
        ok: false,
        duplicate: true,
        message: "Este correo ya fue registrado. / This email is already registered."
      });
    }

    if (error instanceof ZodError) {
      return jsonResponse(400, {
        ok: false,
        message: "Revisa los campos del formulario. / Please check the form fields.",
        fieldErrors: error.flatten().fieldErrors
      });
    }

    console.error("foreign-signature-error", requestId, error);
    return jsonResponse(500, { ok: false, message: "Error interno. Por favor intenta nuevamente." });
  }
};
