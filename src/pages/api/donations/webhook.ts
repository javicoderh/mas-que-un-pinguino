import type { APIRoute } from "astro";
import { withPostgres } from "../../../lib/db/postgres";
import { getPaymentStatus } from "../../../lib/flow/client";
import { isFlowConfigured } from "../../../lib/flow/config";
import { sendDonationConfirmationEmail } from "../../../lib/email/donation-confirmation";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!isFlowConfigured) {
    return new Response("ok", { status: 200 });
  }

  let token: string | null = null;

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await request.text();
    token = new URLSearchParams(text).get("token");
  } else {
    try {
      const body = await request.json();
      token = body?.token ?? null;
    } catch {
      token = null;
    }
  }

  if (!token) {
    return new Response("missing token", { status: 400 });
  }

  try {
    const payment = await getPaymentStatus(token);
    const now = Date.now();

    if (payment.status === 2) {
      const receipt = payment.paymentData?.receipt;
      if (!receipt) {
        // Flow must always include a receipt for confirmed payments.
        // Return 500 so Flow retries the webhook once the receipt is available.
        console.error("[donations/webhook] paid status but no receipt — rejecting for retry", { token });
        return new Response("missing receipt", { status: 500 });
      }

      const paidAt = payment.paymentData?.date
        ? new Date(payment.paymentData.date).getTime()
        : now;

      const updated = await withPostgres(async (sql) => {
        const rows = await sql<{
          donor_name: string;
          email: string;
          amount: number;
          currency: string;
          language: string;
          receipt_number: string | null;
        }[]>`
          update donations set
            status = 'paid',
            receipt_number = ${receipt},
            paid_at_ms = ${paidAt},
            updated_at_ms = ${now}
          where flow_token = ${token}
            and status != 'paid'
          returning donor_name, email, amount, currency, language, receipt_number
        `;
        return rows[0] ?? null;
      });

      if (updated) {
        sendDonationConfirmationEmail({
          email: updated.email,
          donorName: updated.donor_name,
          amount: updated.amount,
          currency: updated.currency as "CLP" | "USD",
          language: updated.language as "es" | "en",
          receiptNumber: updated.receipt_number,
        }).catch((err) => console.error("[donations/webhook] email error:", err));
      }
    } else if (payment.status === 3 || payment.status === 4) {
      const newStatus = payment.status === 3 ? "rejected" : "cancelled";
      await withPostgres(async (sql) => {
        await sql`
          update donations set
            status = ${newStatus},
            updated_at_ms = ${now}
          where flow_token = ${token}
            and status = 'pending'
        `;
      });
    }
  } catch (error) {
    console.error("[donations/webhook]", error);
    return new Response("error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
};
