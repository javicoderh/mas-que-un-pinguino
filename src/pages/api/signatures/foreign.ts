import type { APIRoute } from "astro";
import { z, ZodError } from "zod";
import { isSecurityConfigured, isServerStorageConfigured, securityConfig } from "../../../lib/security/config";
import { verifyFormToken } from "../../../lib/security/form-token";
import { hashWithSecret } from "../../../lib/security/hash";
import { logSecurityEvent, emitSecurityMetric } from "../../../lib/security/logging";
import { getClientIp, getUserAgent, isAllowedOrigin } from "../../../lib/security/request";
import { enforceRateLimit } from "../../../lib/security/rate-limit";
import { isTokenUsed, markTokenUsed } from "../../../lib/security/token-store";
import { verifyCaptchaToken } from "../../../lib/security/captcha";
import { withPostgres, isUniqueViolation } from "../../../lib/db/postgres";
import { bumpForeignSignatureCounterCache } from "../../../lib/security/storage";
import { securityMessages } from "../../../lib/security/messages";

export const prerender = false;

const suspiciousUserAgentPattern = /(curl|wget|python|httpclient|scrapy|aiohttp|bot|headless)/i;

const foreignSignatureSchema = z.object({
  name: z.string().min(2).max(120),
  country: z.string().min(2).max(80),
  reason: z.string().min(5).max(600),
  email: z.string().email(),
  consent: z.literal(true)
});

const jsonResponse = (status: number, body: Record<string, unknown>, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers }
  });

export const POST: APIRoute = async ({ request, url }) => {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  if (!isSecurityConfigured || !isServerStorageConfigured) {
    return jsonResponse(503, { ok: false, message: securityMessages.genericFailure });
  }

  // Payload size guard
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > securityConfig.maxPayloadBytes) {
    return jsonResponse(413, { ok: false, message: securityMessages.invalidSubmission });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data") && !contentType.includes("application/x-www-form-urlencoded")) {
    return jsonResponse(415, { ok: false, message: securityMessages.invalidSubmission });
  }

  const ip = getClientIp(request.headers);
  const userAgent = getUserAgent(request.headers);
  const ipHash = await hashWithSecret(securityConfig.hashSecret, "ip", ip);
  const userAgentHash = await hashWithSecret(securityConfig.hashSecret, "ua", userAgent);
  const fingerprintHash = await hashWithSecret(
    securityConfig.hashSecret,
    "fp",
    ip,
    userAgent.slice(0, 120),
    request.headers.get("accept-language") ?? ""
  );

  // Rate limiting — IP and fingerprint
  const [ipRateLimit, fpRateLimit] = await Promise.all([
    enforceRateLimit(
      "foreign_signature_post_ip",
      ipHash,
      securityConfig.rateLimits.signaturePostIp,
      { route: url.pathname, action: "foreign_signature_post" }
    ),
    enforceRateLimit(
      "foreign_signature_post_fingerprint",
      fingerprintHash,
      securityConfig.rateLimits.signaturePostFingerprint,
      { route: url.pathname, action: "foreign_signature_post" }
    )
  ]);

  if (!ipRateLimit.allowed || !fpRateLimit.allowed) {
    const retryAfter = Math.max(ipRateLimit.retryAfterSeconds, fpRateLimit.retryAfterSeconds, 60);
    logSecurityEvent({
      route: url.pathname,
      action: "foreign_signature_post",
      decision: "block",
      reasonCodes: ["rate_limited"],
      hashedIp: ipHash,
      hashedUserAgent: userAgentHash,
      hashedFingerprint: fingerprintHash,
      requestId
    });
    await emitSecurityMetric("foreign_signature.rate_limited", 1, { route: url.pathname });
    return jsonResponse(429, { ok: false, message: securityMessages.rateLimited }, { "retry-after": String(retryAfter) });
  }

  const formData = await request.formData();
  const honeypot = String(formData.get("company") ?? "").trim();
  const issuedAtMs = Number(formData.get("issued_at_ms") ?? "0");
  const nonce = String(formData.get("form_nonce") ?? "");
  const token = String(formData.get("form_token") ?? "");
  const captchaToken = String(formData.get("captcha_token") ?? "");

  const tokenValid =
    Number.isFinite(issuedAtMs) &&
    nonce.length > 0 &&
    token.length > 0 &&
    (await verifyFormToken({ issuedAtMs, nonce, intent: "foreign_signature_submit" }, token));

  const submitTimeMs = Date.now() - issuedAtMs;

  if (!tokenValid || submitTimeMs > securityConfig.maxTokenAgeMs) {
    return jsonResponse(400, { ok: false, message: securityMessages.invalidSubmission });
  }

  // Token replay prevention
  const bypassReadChecks = securityConfig.bypassSignatureReadChecks;
  const tokenAlreadyUsed = bypassReadChecks ? false : await isTokenUsed(nonce);
  if (tokenAlreadyUsed) {
    return jsonResponse(400, { ok: false, message: securityMessages.invalidSubmission });
  }

  const invalidOrigin = !isAllowedOrigin(request);
  const suspiciousUserAgent = suspiciousUserAgentPattern.test(userAgent);
  const honeypotFilled = Boolean(honeypot);
  const tooFast = submitTimeMs < securityConfig.minSubmitTimeMs;
  const captcha = await verifyCaptchaToken(captchaToken, ip);

  // Block obvious bots immediately
  if (honeypotFilled || (tooFast && suspiciousUserAgent) || (invalidOrigin && !captcha.verified)) {
    logSecurityEvent({
      route: url.pathname,
      action: "foreign_signature_post",
      decision: "block",
      reasonCodes: [
        honeypotFilled ? "honeypot" : tooFast ? "too_fast" : "invalid_origin"
      ],
      hashedIp: ipHash,
      hashedUserAgent: userAgentHash,
      hashedFingerprint: fingerprintHash,
      requestId,
      metadata: { submitTimeMs }
    });
    await emitSecurityMetric("foreign_signature.blocked", 1, { route: url.pathname });
    return jsonResponse(400, { ok: false, message: securityMessages.invalidSubmission });
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
        insert into foreign_signatures
          (id, name, country, reason, email, email_hash, status, source_ip_hash, created_at_ms, updated_at_ms)
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

    await markTokenUsed(nonce, securityConfig.maxTokenAgeMs);
    bumpForeignSignatureCounterCache();

    logSecurityEvent({
      route: url.pathname,
      action: "foreign_signature_post",
      decision: "allow",
      reasonCodes: [],
      hashedIp: ipHash,
      hashedUserAgent: userAgentHash,
      hashedFingerprint: fingerprintHash,
      requestId,
      metadata: { submitTimeMs }
    });
    await emitSecurityMetric("foreign_signature.accepted", 1, { route: url.pathname });

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
        message: securityMessages.invalidSubmission,
        fieldErrors: error.flatten().fieldErrors
      });
    }

    console.error("foreign-signature-error", requestId, error);
    return jsonResponse(500, { ok: false, message: securityMessages.genericFailure });
  }
};
