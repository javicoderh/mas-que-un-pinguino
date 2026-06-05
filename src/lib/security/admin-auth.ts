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

const serialize = (username: string, expiresAtMs: number, nonce: string) =>
  `${username}.${expiresAtMs}.${nonce}.${sessionIntent}`;

export async function createAdminSessionCookie(username: string) {
  const expiresAtMs = Date.now() + adminSessionTtlMs;
  const nonce = crypto.randomUUID();
  const signature = await hmacSha256Base64Url(securityConfig.hashSecret, serialize(username, expiresAtMs, nonce));
  return `${username}.${expiresAtMs}.${nonce}.${signature}`;
}

export async function verifyAdminSessionCookie(value: string | undefined | null): Promise<AdminSession | null> {
  if (!value) return null;

  const parts = value.split(".");
  if (parts.length < 4) return null;

  // signature is last part, nonce is second-to-last, expiresAtMs is second, username is first
  // But username can contain dots in theory — use fixed positions from right
  const signature = parts[parts.length - 1];
  const nonce = parts[parts.length - 2];
  const expiresRaw = parts[parts.length - 3];
  const username = parts.slice(0, parts.length - 3).join(".");

  const expiresAtMs = Number(expiresRaw);

  if (!username || !nonce || !signature || !Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) {
    return null;
  }

  const expected = await hmacSha256Base64Url(
    securityConfig.hashSecret,
    serialize(username, expiresAtMs, nonce)
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
