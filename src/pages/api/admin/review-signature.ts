import type { APIRoute } from "astro";
import { AdminUnauthorizedError, redirectUnauthorized, requireAdminSession } from "../../../lib/security/admin-middleware";
import { reviewFlaggedSignature } from "../../../lib/security/storage";
import { isServerStorageConfigured } from "../../../lib/security/config";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    await requireAdminSession(cookies);
  } catch (error) {
    if (error instanceof AdminUnauthorizedError) return redirectUnauthorized();
    throw error;
  }

  if (!isServerStorageConfigured) {
    return new Response(null, { status: 302, headers: { location: "/admin?error=config" } });
  }

  const formData = await request.formData();
  const signatureId = String(formData.get("signature_id") ?? "");
  const decision = String(formData.get("decision") ?? "");

  if (!signatureId || !["accepted", "rejected"].includes(decision)) {
    return new Response(null, {
      status: 302,
      headers: { location: "/admin?error=invalid_review" }
    });
  }

  try {
    await reviewFlaggedSignature({
      signatureId,
      decision: decision as "accepted" | "rejected"
    });
    return new Response(null, { status: 302, headers: { location: "/admin?signature_review=ok" } });
  } catch (error) {
    console.error(error);
    return new Response(null, {
      status: 302,
      headers: { location: "/admin?error=review_failed" }
    });
  }
};
