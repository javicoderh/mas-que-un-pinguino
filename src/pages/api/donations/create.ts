import type { APIRoute } from "astro";
import { z } from "zod";
import { withPostgres } from "../../../lib/db/postgres";
import { createPaymentOrder } from "../../../lib/flow/client";
import { isFlowConfigured } from "../../../lib/flow/config";

export const prerender = false;

const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  amount: z.number().positive(),
  currency: z.enum(["CLP", "USD"]).default("CLP"),
  language: z.enum(["es", "en"]).default("es"),
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export const POST: APIRoute = async ({ request, url }) => {
  if (!isFlowConfigured) {
    return json(503, { ok: false, message: "Pagos no disponibles temporalmente." });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, message: "Datos inválidos." });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return json(400, { ok: false, message: "Datos inválidos.", errors: parsed.error.flatten() });
  }

  const { name, email, currency, language } = parsed.data;
  let { amount } = parsed.data;

  const minAmount = currency === "USD" ? 1 : 500;
  if (amount < minAmount) {
    return json(400, {
      ok: false,
      message:
        language === "en"
          ? `Minimum amount is $${minAmount} ${currency}.`
          : `El monto mínimo es $${minAmount} ${currency}.`,
    });
  }

  // Flow expects integer amounts; for USD convert dollars to cents
  const flowAmount = currency === "USD" ? Math.round(amount * 100) : Math.round(amount);

  const subject =
    language === "en"
      ? "Donation – Save the Humboldt Penguin"
      : "Donación Salvemos Humboldt";

  const donationId = crypto.randomUUID();
  const now = Date.now();
  const origin = url.origin;

  try {
    const flowResult = await createPaymentOrder({
      subject,
      amount: flowAmount,
      email,
      currency,
      urlConfirmation: `${origin}/api/donations/webhook`,
      urlReturn: `${origin}/donar/gracias`,
      optional: { donationId },
    });

    await withPostgres(async (sql) => {
      await sql`
        insert into donations (id, flow_order, flow_token, donor_name, email, amount, currency, language, status, created_at_ms, updated_at_ms)
        values (
          ${donationId},
          ${String(flowResult.flowOrder)},
          ${flowResult.token},
          ${name},
          ${email},
          ${Math.round(amount)},
          ${currency},
          ${language},
          'pending',
          ${now},
          ${now}
        )
      `;
    });

    return json(200, {
      ok: true,
      redirectUrl: `${flowResult.url}?token=${flowResult.token}`,
    });
  } catch (error) {
    console.error("[donations/create]", error);
    return json(500, {
      ok: false,
      message:
        language === "en"
          ? "Payment error. Please try again."
          : "Error al crear el pago. Intenta nuevamente.",
    });
  }
};
