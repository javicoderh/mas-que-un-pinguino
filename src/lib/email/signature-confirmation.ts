import { campaignConfig } from "../../content/campaign";
import { isSmtpConfigured, sendEmail } from "./smtp";

export interface SignatureConfirmationInput {
  email: string;
  fullName: string;
  rut?: string;
  country?: string;
  city?: string;
  status: "accepted" | "flagged";
}

export async function sendSignatureConfirmationEmail(input: SignatureConfirmationInput) {
  if (!isSmtpConfigured) {
    return;
  }

  const siteUrl = campaignConfig.site.siteUrl;
  const supportEmail = campaignConfig.site.contactEmail;

  const subject =
    input.status === "accepted"
      ? "Tu firma fue registrada en Es más que un pingüino"
      : "Recibimos tu firma para Es más que un pingüino";

  const greetingName = input.fullName.trim() || "Hola";

  const statusLine =
    input.status === "accepted"
      ? "Tu firma quedó registrada para la campaña ciudadana <strong>Es más que un pingüino</strong>."
      : "Recibimos tu firma para la campaña ciudadana <strong>Es más que un pingüino</strong> y quedó en una revisión breve antes de su publicación.";

  const statusLinePlain =
    input.status === "accepted"
      ? "Tu firma quedó registrada para la campaña ciudadana Es más que un pingüino."
      : "Recibimos tu firma para la campaña ciudadana Es más que un pingüino y quedó en una revisión breve antes de su publicación.";

  const disputeLine = input.rut
    ? "Si tú no realizaste esta firma, responde este correo indicando que no firmaste y escribe tu RUT para que podamos ubicar y eliminar el registro de la campaña."
    : "Si tú no realizaste esta firma, responde este correo indicando que no firmaste y menciona el país y ciudad con que aparece este registro para que podamos ubicarlo y eliminarlo.";

  const text = [
    `${greetingName},`,
    "",
    statusLinePlain,
    "",
    "Gracias por sumarte a esta campaña ciudadana por la protección del pingüino de Humboldt.",
    "",
    disputeLine,
    "",
    `Correo de contacto: ${supportEmail}`,
    "",
    "Equipo Es más que un pingüino",
    siteUrl
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#05070b;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#05070b;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <img
                src="${siteUrl}/assets/logo-pinguino.png"
                alt="Logo pingüino de Humboldt"
                width="80"
                height="80"
                style="display:block;border-radius:50%;border:1px solid rgba(255,255,255,0.12);"
              />
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03));border:1px solid rgba(255,255,255,0.1);border-radius:24px;padding:40px 36px;">

              <!-- Eyebrow -->
              <p style="margin:0 0 20px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#38B6FF;">
                Campaña ciudadana
              </p>

              <!-- Greeting -->
              <p style="margin:0 0 16px;font-size:26px;font-weight:800;color:#ffffff;line-height:1.2;">
                ${escapeHtml(greetingName)},
              </p>

              <!-- Status -->
              <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#a0b4c8;">
                ${statusLine}
              </p>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="border-top:1px solid rgba(255,255,255,0.08);font-size:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Thank you -->
              <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:#a0b4c8;">
                Gracias por sumarte a esta campaña ciudadana por la protección del pingüino de Humboldt.
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center" style="background-color:#E8CF63;border-radius:100px;">
                    <a href="${siteUrl}/carta" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:700;color:#05070b;text-decoration:none;letter-spacing:0.02em;">
                      Ver la carta ciudadana
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="border-top:1px solid rgba(255,255,255,0.08);font-size:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Dispute -->
              <p style="margin:0;font-size:13px;line-height:1.7;color:#637a8a;">
                ${escapeHtml(disputeLine)}
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:28px;">
              <p style="margin:0 0 6px;font-size:12px;color:#3d5263;">
                Equipo <strong style="color:#4d6a7a;">Es más que un pingüino</strong>
              </p>
              <p style="margin:0;font-size:12px;color:#3d5263;">
                <a href="mailto:${supportEmail}" style="color:#38B6FF;text-decoration:none;">${supportEmail}</a>
                &nbsp;·&nbsp;
                <a href="${siteUrl}" style="color:#38B6FF;text-decoration:none;">esmasqueunpinguino.cl</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await sendEmail({ to: input.email, subject, text, html });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
