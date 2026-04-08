import { defineMiddleware } from "astro:middleware";
import { securityConfig, isSecurityConfigured, isServerStorageConfigured } from "./lib/security/config";
import { enforceRateLimit } from "./lib/security/rate-limit";
import { hashWithSecret } from "./lib/security/hash";
import { logSecurityEvent } from "./lib/security/logging";
import { securityMessages } from "./lib/security/messages";
import { getClientIp } from "./lib/security/request";

const publicSecurityHeaders = {
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "strict-transport-security": "max-age=31536000; includeSubDomains; preload"
} as const;

const html429 = (message: string) =>
  `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Intenta nuevamente</title></head><body style="font-family:system-ui,sans-serif;background:#05070B;color:#fff;padding:2rem;line-height:1.6"><main style="max-width:36rem;margin:10vh auto"><h1 style="font-size:1.75rem;margin-bottom:1rem">Estamos recibiendo mucho tráfico</h1><p>${message}</p></main></body></html>`;

export const onRequest = defineMiddleware(async (context, next) => {
  const requestId = crypto.randomUUID();

  if (
    !["/firma", "/eventos/proponer"].includes(context.url.pathname) ||
    context.request.method !== "GET" ||
    !isSecurityConfigured ||
    !isServerStorageConfigured
  ) {
    const response = await next();

    Object.entries(publicSecurityHeaders).forEach(([key, value]) => {
      if (!response.headers.has(key)) {
        response.headers.set(key, value);
      }
    });

    if (context.url.pathname.startsWith("/api/") && !response.headers.has("cache-control")) {
      response.headers.set("cache-control", "no-store");
    }

    response.headers.set("x-request-id", requestId);
    return response;
  }

  const ip = getClientIp(context.request.headers);
  const ipHash = await hashWithSecret(securityConfig.hashSecret, "ip", ip);
  const result = await enforceRateLimit("signature_form_get", ipHash, securityConfig.rateLimits.formGet, {
    route: context.url.pathname,
    action: context.url.pathname === "/firma" ? "signature_form_get" : "event_form_get"
  });

  if (result.allowed) {
    const response = await next();

    Object.entries(publicSecurityHeaders).forEach(([key, value]) => {
      if (!response.headers.has(key)) {
        response.headers.set(key, value);
      }
    });

    if (context.url.pathname.startsWith("/api/") && !response.headers.has("cache-control")) {
      response.headers.set("cache-control", "no-store");
    }

    response.headers.set("x-request-id", requestId);
    return response;
  }

  logSecurityEvent({
      route: context.url.pathname,
      action: context.url.pathname === "/firma" ? "signature_form_get" : "event_form_get",
      decision: "block",
      reasonCodes: ["rate_limited"],
      hashedIp: ipHash,
      requestId,
    metadata: result.counts
  });

  return new Response(html429(securityMessages.rateLimited), {
    status: 429,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "retry-after": String(result.retryAfterSeconds),
      "x-request-id": requestId,
      ...publicSecurityHeaders
    }
  });
});
