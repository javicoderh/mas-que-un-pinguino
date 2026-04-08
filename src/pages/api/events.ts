import type { APIRoute } from "astro";
import { ZodError } from "zod";
import { securityMessages } from "../../lib/security/messages";
import { isSecurityConfigured, isServerStorageConfigured, securityConfig } from "../../lib/security/config";
import { getClientIp, getUserAgent, isAllowedOrigin } from "../../lib/security/request";
import { hashWithSecret } from "../../lib/security/hash";
import { enforceRateLimit } from "../../lib/security/rate-limit";
import { verifyFormToken } from "../../lib/security/form-token";
import { verifyCaptchaToken } from "../../lib/security/captcha";
import { scoreSignatureRisk } from "../../lib/security/risk-score";
import { emitSecurityMetric, logSecurityEvent } from "../../lib/security/logging";
import { eventSubmissionExists, listApprovedEvents, storeEventSubmission } from "../../lib/security/events-storage";
import { parseEventSubmissionPayload } from "../../lib/validation/event-schema";

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

export const GET: APIRoute = async () => {
  try {
    if (!isServerStorageConfigured) {
      return jsonResponse(200, { ok: true, events: [] }, { "cache-control": "public, max-age=60" });
    }

    const events = await listApprovedEvents();
    return jsonResponse(
      200,
      {
        ok: true,
        events: events.map((event) => ({
          id: event.id,
          title: event.title,
          description: event.description,
          imageUrl: event.imageUrl,
          date: event.date,
          time: event.time,
          region: event.region,
          regionKey: event.regionKey,
          venue: event.venue
        }))
      },
      { "cache-control": "public, max-age=120" }
    );
  } catch (error) {
    console.error(error);
    return jsonResponse(200, { ok: true, events: [] }, { "cache-control": "no-store" });
  }
};

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
    "event-fp",
    ip,
    userAgent.slice(0, 120),
    request.headers.get("accept-language") ?? ""
  );

  const ipRateLimit = await enforceRateLimit("event_post_ip", ipHash, securityConfig.rateLimits.eventPostIp, {
    route: url.pathname,
    action: "event_post"
  });

  if (!ipRateLimit.allowed) {
    logSecurityEvent({
      route: url.pathname,
      action: "event_post",
      decision: "block",
      reasonCodes: ["rate_limited"],
      hashedIp: ipHash,
      hashedUserAgent: userAgentHash,
      hashedFingerprint: fingerprintHash,
      metadata: ipRateLimit.counts
    });

    return jsonResponse(
      429,
      { ok: false, message: securityMessages.rateLimited },
      { "retry-after": String(ipRateLimit.retryAfterSeconds) }
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
    (await verifyFormToken({ issuedAtMs, nonce, intent: "event_submit" }, token));
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
    const event = parseEventSubmissionPayload({
      title: formData.get("title"),
      description: formData.get("description"),
      imageUrl: formData.get("image_url"),
      date: formData.get("date"),
      time: formData.get("time"),
      region: formData.get("region"),
      venue: formData.get("venue"),
      organizerName: formData.get("organizer_name"),
      organizerEmail: formData.get("organizer_email"),
      consent: formData.get("consent") === "on"
    });

    const duplicateHash = await hashWithSecret(
      securityConfig.hashSecret,
      "event-dedupe",
      event.normalized.dedupe
    );
    const duplicateDetected = await eventSubmissionExists(duplicateHash);

    const risk = scoreSignatureRisk({
      submitTimeMs,
      minSubmitTimeMs: securityConfig.minSubmitTimeMs,
      honeypotFilled: Boolean(honeypot),
      invalidOrigin,
      suspiciousUserAgent,
      duplicateDetected,
      repeatedIpCooldownHit: Number(ipRateLimit.counts.window ?? 0) > 1,
      ipBurstCount: Number(ipRateLimit.counts.burst ?? 0),
      fingerprintBurstCount: 0,
      captchaVerified: captcha.verified,
      highProtectionMode: securityConfig.highProtectionMode
    });

    if (duplicateDetected) {
      return jsonResponse(409, {
        ok: false,
        duplicate: true,
        message: securityMessages.eventDuplicate
      });
    }

    if (risk.decision === "block") {
      logSecurityEvent({
        route: url.pathname,
        action: "event_post",
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
    const status = risk.decision === "flag" ? "flagged" : "pending";

    await storeEventSubmission({
      event,
      status,
      riskDecision: risk.decision,
      riskReasons: risk.reasonCodes,
      riskScore: risk.score,
      duplicateHash,
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

    await emitSecurityMetric("event.submission.accepted", 1, { route: url.pathname, status });

    return jsonResponse(200, {
      ok: true,
      status,
      message: securityMessages.eventSuccess
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonResponse(400, {
        ok: false,
        message: error.issues[0]?.message ?? securityMessages.invalidSubmission
      });
    }

    console.error(error);
    return jsonResponse(500, {
      ok: false,
      message: securityMessages.genericFailure
    });
  }
};
