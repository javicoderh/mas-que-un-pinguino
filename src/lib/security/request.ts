import { securityConfig } from "./config";

const pickFirstIp = (value: string | null) => value?.split(",")[0]?.trim() ?? "";

export function getClientIp(headers: Headers) {
  const candidates = [
    headers.get("cf-connecting-ip"),
    headers.get("x-forwarded-for"),
    headers.get("x-real-ip"),
    headers.get("fly-client-ip"),
    headers.get("x-vercel-forwarded-for")
  ];

  for (const candidate of candidates) {
    const ip = pickFirstIp(candidate);
    if (ip) return ip;
  }

  return "0.0.0.0";
}

export function getUserAgent(headers: Headers) {
  return headers.get("user-agent")?.trim() || "unknown";
}

export function isAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (!origin && !referer) return true;

  const allowed = securityConfig.allowedOrigins;
  const originOk = origin ? allowed.includes(origin) : false;
  const refererOk = referer ? allowed.some((value) => referer.startsWith(value)) : false;
  return originOk || refererOk;
}
