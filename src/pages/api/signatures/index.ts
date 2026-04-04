import type { APIRoute } from "astro";
import { ZodError } from "zod";
import { isSecurityConfigured, isServerStorageConfigured, securityConfig } from "../../../lib/security/config";
import { verifyFormToken } from "../../../lib/security/form-token";
import { hashWithSecret } from "../../../lib/security/hash";
import { logSecurityEvent, emitSecurityMetric } from "../../../lib/security/logging";
import { securityMessages } from "../../../lib/security/messages";
import { getClientIp, getUserAgent, isAllowedOrigin } from "../../../lib/security/request";
import { scoreSignatureRisk } from "../../../lib/security/risk-score";
import { enforceRateLimit } from "../../../lib/security/rate-limit";
import { buildSignatureDedupeKeys } from "../../../lib/security/dedupe";
import { verifyCaptchaToken } from "../../../lib/security/captcha";
import { parseSignaturePayload } from "../../../lib/validation/signature-schema";
import { getDuplicateMatch, storeSignature } from "../../../lib/security/storage";

export const prerender = false;

const suspiciousUserAgentPattern = /(curl|wget|python|httpclient|scrapy|aiohttp|bot|headless)/i;

const jsonResponse = (status: number, body: Record<string, unknown>, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers
    }
  });

export const POST: APIRoute = async ({ request, url }) => {
  if (!isSecurityConfigured || !isServerStorageConfigured) {
    return jsonResponse(503, {
      ok: false,
      message: securityMessages.genericFailure
    });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > securityConfig.maxPayloadBytes) {
    return jsonResponse(413, {
      ok: false,
      message: securityMessages.invalidSubmission
    });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data") && !contentType.includes("application/x-www-form-urlencoded")) {
    return jsonResponse(415, {
      ok: false,
      message: securityMessages.invalidSubmission
    });
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

  const ipRateLimit = await enforceRateLimit("signature_post_ip", ipHash, securityConfig.rateLimits.signaturePostIp, {
    route: url.pathname,
    action: "signature_post"
  });
  const fingerprintRateLimit = await enforceRateLimit(
    "signature_post_fingerprint",
    fingerprintHash,
    securityConfig.rateLimits.signaturePostFingerprint,
    {
      route: url.pathname,
      action: "signature_post"
    }
  );

  if (!ipRateLimit.allowed || !fingerprintRateLimit.allowed) {
    const retryAfter = Math.max(ipRateLimit.retryAfterSeconds, fingerprintRateLimit.retryAfterSeconds, 60);
    logSecurityEvent({
      route: url.pathname,
      action: "signature_post",
      decision: "block",
      reasonCodes: ["rate_limited"],
      hashedIp: ipHash,
      hashedUserAgent: userAgentHash,
      hashedFingerprint: fingerprintHash,
      metadata: {
        ipCounts: ipRateLimit.counts,
        fingerprintCounts: fingerprintRateLimit.counts
      }
    });
    await emitSecurityMetric("signature.rate_limited", 1, { route: url.pathname });

    return jsonResponse(
      429,
      {
        ok: false,
        message: securityMessages.rateLimited
      },
      { "retry-after": String(retryAfter) }
    );
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
    (await verifyFormToken({ issuedAtMs, nonce, intent: "signature_submit" }, token));
  const submitTimeMs = Date.now() - issuedAtMs;
  const invalidOrigin = !isAllowedOrigin(request);
  const suspiciousUserAgent = suspiciousUserAgentPattern.test(userAgent);
  const captcha = await verifyCaptchaToken(captchaToken, ip);

  if (!tokenValid || submitTimeMs > securityConfig.maxTokenAgeMs) {
    return jsonResponse(400, {
      ok: false,
      message: securityMessages.invalidSubmission
    });
  }

  try {
    const signature = parseSignaturePayload({
      firstName: formData.get("first_name"),
      lastName: formData.get("last_name"),
      rut: formData.get("rut"),
      email: formData.get("email"),
      age: formData.get("age"),
      country: formData.get("country"),
      legalNature: formData.get("legal_nature"),
      region: formData.get("region"),
      commune: formData.get("commune"),
      affiliation: formData.get("affiliation"),
      message: formData.get("message"),
      adultDeclaration: formData.get("adult_declaration") === "on",
      consent: formData.get("consent") === "on",
      updates: formData.get("updates") === "on"
    });

    const dedupeKeys = await buildSignatureDedupeKeys({
      normalizedEmail: signature.normalized.email,
      normalizedIdentity: signature.normalized.identity,
      normalizedRut: signature.normalized.rut,
      ipHash
    });

    const duplicateMatch = await getDuplicateMatch({
      emailHash: dedupeKeys.emailHash,
      identityHash: dedupeKeys.identityHash,
      rutHash: dedupeKeys.rutHash
    });
    const duplicateDetected = duplicateMatch.any;

    const risk = scoreSignatureRisk({
      submitTimeMs,
      minSubmitTimeMs: securityConfig.minSubmitTimeMs,
      honeypotFilled: Boolean(honeypot),
      invalidOrigin,
      suspiciousUserAgent,
      duplicateDetected,
      repeatedIpCooldownHit: Number(ipRateLimit.counts.window ?? 0) > 1,
      ipBurstCount: Number(ipRateLimit.counts.burst ?? 0),
      fingerprintBurstCount: Number(fingerprintRateLimit.counts.burst ?? 0),
      captchaVerified: captcha.verified,
      highProtectionMode: securityConfig.highProtectionMode
    });

    if (duplicateDetected) {
      logSecurityEvent({
        route: url.pathname,
        action: "signature_post",
        decision: "block",
        reasonCodes: ["duplicate_signature"],
        hashedIp: ipHash,
        hashedUserAgent: userAgentHash,
        hashedFingerprint: fingerprintHash
      });

      return jsonResponse(409, {
        ok: false,
        duplicate: true,
        message: duplicateMatch.rut ? securityMessages.duplicateRut : securityMessages.duplicate
      });
    }

    if (risk.decision === "block") {
      logSecurityEvent({
        route: url.pathname,
        action: "signature_post",
        decision: "block",
        reasonCodes: risk.reasonCodes,
        hashedIp: ipHash,
        hashedUserAgent: userAgentHash,
        hashedFingerprint: fingerprintHash,
        metadata: { submitTimeMs }
      });

      return jsonResponse(400, {
        ok: false,
        message: securityMessages.invalidSubmission
      });
    }

    const submittedAtMs = Date.now();
    const status = risk.decision === "flag" ? "flagged" : "accepted";

    await storeSignature({
      signature,
      status,
      abuseReason: risk.reasonCodes[0] ?? null,
      riskDecision: risk.decision,
      riskReasons: risk.reasonCodes,
      riskScore: risk.score,
      dedupeKeys,
      source: {
        ipHash,
        userAgentHash,
        fingerprintHash,
        submittedAtMs,
        originHost: request.headers.get("origin")
          ? new URL(request.headers.get("origin")!).host
          : null
      },
      metadata: {
        tokenIssuedAtMs: issuedAtMs,
        submitTimeMs,
        captchaVerified: captcha.verified,
        highProtectionMode: securityConfig.highProtectionMode
      }
    });

    logSecurityEvent({
      route: url.pathname,
      action: "signature_post",
      decision: risk.decision,
      reasonCodes: risk.reasonCodes,
      hashedIp: ipHash,
      hashedUserAgent: userAgentHash,
      hashedFingerprint: fingerprintHash,
      metadata: { status }
    });
    await emitSecurityMetric("signature.accepted", 1, { status, route: url.pathname });

    return jsonResponse(200, {
      ok: true,
      status,
      message: status === "flagged" ? securityMessages.review : securityMessages.success
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("FAILED_PRECONDITION") ||
        error.message.includes("ALREADY_EXISTS") ||
        error.message.includes("firestore-commit-failed:409"))
    ) {
      return jsonResponse(409, {
        ok: false,
        duplicate: true,
        message: securityMessages.duplicate
      });
    }

    if (error instanceof ZodError) {
      return jsonResponse(400, {
        ok: false,
        message: securityMessages.invalidSubmission,
        fieldErrors: error.flatten().fieldErrors
      });
    }

    console.error(error);
    return jsonResponse(500, {
      ok: false,
      message: securityMessages.genericFailure
    });
  }
};
