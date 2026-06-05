import type { AstroCookies } from "astro";
import { getAdminSessionFromCookies, type AdminSession } from "./admin-auth";
import { securityMessages } from "./messages";

export class AdminUnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AdminUnauthorizedError";
  }
}

export function redirectUnauthorized(message?: string): Response {
  const msg = encodeURIComponent(message ?? securityMessages.adminUnauthorized);
  return new Response(null, {
    status: 302,
    headers: { location: `/admin?error=${msg}` }
  });
}

export async function requireAdminSession(cookies: AstroCookies): Promise<AdminSession> {
  const session = await getAdminSessionFromCookies(cookies);
  if (!session) {
    throw new AdminUnauthorizedError();
  }
  return session;
}
