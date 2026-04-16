import type { APIRoute } from "astro";
import { clearAdminSessionCookie, createAdminSessionCookie, setAdminSessionCookie } from "../../../lib/security/admin-auth";
import { securityMessages } from "../../../lib/security/messages";
import { enforceRateLimit } from "../../../lib/security/rate-limit";
import { hashWithSecret } from "../../../lib/security/hash";
import { getClientIp } from "../../../lib/security/request";
import { isSecurityConfigured, isServerStorageConfigured, securityConfig } from "../../../lib/security/config";
import { getAdminUserByUsername } from "../../../lib/security/events-storage";
import { verifyPassword } from "../../../lib/security/password";

export const prerender = false;

const redirect = (location: string) =>
  new Response(null, { status: 302, headers: { location } });

export const POST: APIRoute = async ({ request, cookies, url }) => {
  if (!isSecurityConfigured || !isServerStorageConfigured) {
    return redirect("/admin?error=config");
  }

  const ip = getClientIp(request.headers);
  const ipHash = await hashWithSecret(securityConfig.hashSecret, "admin-ip", ip);
  const rateLimit = await enforceRateLimit("admin_login_ip", ipHash, securityConfig.rateLimits.adminLoginIp, {
    route: url.pathname,
    action: "admin_login"
  });

  if (!rateLimit.allowed) {
    return redirect("/admin?error=rate_limited");
  }

  const formData = await request.formData();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const user = await getAdminUserByUsername(username);
  const valid =
    user?.active &&
    (await verifyPassword(password, {
      salt: user.passwordSalt,
      hash: user.passwordHash,
      iterations: user.passwordIterations
    }));

  if (!valid) {
    clearAdminSessionCookie(cookies);
    return redirect(`/admin?error=${encodeURIComponent(securityMessages.adminInvalidCredentials)}`);
  }

  const session = await createAdminSessionCookie(user.username);
  setAdminSessionCookie(cookies, session);
  return redirect("/admin");
};
