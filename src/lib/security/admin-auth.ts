import type { AstroCookies } from "astro";
import { securityConfig } from "./config";
import { hmacSha256Base64Url } from "./hash";

const adminSessionCookieName = "admin_session";
const adminSessionTtlMs = 1000 * 60 * 60 * 12;
const sessionIntent = "admin_session";

export interface AdminSession {
  username: string;
  expiresAtMs: number;
}

const serialize = (session: AdminSession) => `${session.username}.${session.expiresAtMs}.${sessionIntent}`;

export async function createAdminSessionCookie(username: string) {
  const expiresAtMs = Date.now() + adminSessionTtlMs;
  const payload = { username, expiresAtMs };
  const signature = await hmacSha256Base64Url(securityConfig.hashSecret, serialize(payload));
  return `${payload.username}.${payload.expiresAtMs}.${signature}`;
}

export async function verifyAdminSessionCookie(value: string | undefined | null): Promise<AdminSession | null> {
  if (!value) return null;

  const [username, expiresRaw, signature] = value.split(".");
  const expiresAtMs = Number(expiresRaw);

  if (!username || !signature || !Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) {
    return null;
  }

  const expected = await hmacSha256Base64Url(
    securityConfig.hashSecret,
    serialize({ username, expiresAtMs })
  );

  if (expected !== signature) {
    return null;
  }

  return { username, expiresAtMs };
}

export async function getAdminSessionFromCookies(cookies: AstroCookies) {
  return verifyAdminSessionCookie(cookies.get(adminSessionCookieName)?.value);
}

export function setAdminSessionCookie(cookies: AstroCookies, value: string) {
  cookies.set(adminSessionCookieName, value, {
    path: "/",
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: "strict",
    maxAge: Math.floor(adminSessionTtlMs / 1000)
  });
}

export function clearAdminSessionCookie(cookies: AstroCookies) {
  cookies.delete(adminSessionCookieName, {
    path: "/"
  });
}
