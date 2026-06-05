import type { APIRoute } from "astro";
import { AdminUnauthorizedError, redirectUnauthorized, requireAdminSession } from "../../../lib/security/admin-middleware";
import { getAdminUserByUsername, updateAdminUserPassword } from "../../../lib/security/events-storage";
import { hashPassword, verifyPassword } from "../../../lib/security/password";
import { isServerStorageConfigured } from "../../../lib/security/config";

export const prerender = false;

const redirect = (location: string) =>
  new Response(null, { status: 302, headers: { location } });

export const POST: APIRoute = async ({ request, cookies }) => {
  let session;
  try {
    session = await requireAdminSession(cookies);
  } catch (error) {
    if (error instanceof AdminUnauthorizedError) return redirectUnauthorized();
    throw error;
  }

  if (!isServerStorageConfigured) {
    return redirect("/admin?error=config");
  }

  const formData = await request.formData();
  const currentPassword = String(formData.get("current_password") ?? "");
  const newPassword = String(formData.get("new_password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (newPassword.length < 12) {
    return redirect("/admin?error=password_too_short");
  }

  if (newPassword !== confirmPassword) {
    return redirect("/admin?error=password_mismatch");
  }

  const user = await getAdminUserByUsername(session.username);
  if (!user) {
    return redirect("/admin?error=user_not_found");
  }

  const valid = await verifyPassword(currentPassword, {
    salt: user.passwordSalt,
    hash: user.passwordHash,
    iterations: user.passwordIterations
  });

  if (!valid) {
    return redirect("/admin?error=wrong_current_password");
  }

  const newHash = await hashPassword(newPassword);
  await updateAdminUserPassword({
    username: session.username,
    passwordHash: newHash.hash,
    passwordSalt: newHash.salt,
    passwordIterations: newHash.iterations
  });

  return redirect("/admin?password_changed=ok");
};
