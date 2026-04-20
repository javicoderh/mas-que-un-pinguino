import { campaignConfig } from "../../content/campaign";
import { isSmtpConfigured, sendEmail } from "./smtp";

export interface DonationConfirmationInput {
  email: string;
  donorName: string;
  amount: number;
  currency: "CLP" | "USD";
  language: "es" | "en";
  receiptNumber: string | null;
}

interface DonationTier {
  title: string;
  impact: string;
  accentColor: string;
}

function getTierEs(amount: number, currency: "CLP" | "USD"): DonationTier {
  const isUsd = currency === "USD";
  const t1 = isUsd ? 3 : 2_000;
  const t2 = isUsd ? 5 : 5_000;
  const t3 = isUsd ? 10 : 10_000;

  if (amount >= t3) {
    return {
      title: "Guardián Humboldt",
      impact:
        "Tu aporte significativo financia directamente equipos de monitoreo científico en terreno y asesoría legal especializada para proteger al pingüino de Humboldt. Eres parte esencial de esta defensa.",
      accentColor: "#E8CF63",
    };
  }
  if (amount >= t2) {
    return {
      title: "Defensor Humboldt",
      impact:
        "Tu donación contribuye a la asesoría legal y al trabajo científico que defiende el hábitat del pingüino de Humboldt. Gracias a personas como tú, esta causa tiene fuerza real.",
      accentColor: "#E8CF63",
    };
  }
  if (amount >= t1) {
    return {
      title: "Apoyo ciudadano",
      impact:
        "Tu aporte ayuda a mantener la campaña activa, financiar el monitoreo científico de la especie y llegar a más personas con esta causa.",
      accentColor: "#38B6FF",
    };
  }
  return {
    title: "Amigo del pingüino",
    impact:
      "Tu contribución mantiene la campaña visible y suma a la defensa del pingüino de Humboldt. Cada apoyo, sin importar el tamaño, hace la diferencia.",
    accentColor: "#38B6FF",
  };
}

function getTierEn(amount: number): DonationTier {
  if (amount >= 10) {
    return {
      title: "Humboldt Guardian",
      impact:
        "Your significant contribution directly funds on-the-ground scientific monitoring teams and specialized legal counsel to protect the Humboldt penguin. You are an essential part of this defense.",
      accentColor: "#E8CF63",
    };
  }
  if (amount >= 5) {
    return {
      title: "Humboldt Defender",
      impact:
        "Your donation contributes to the legal and scientific work defending the Humboldt penguin's habitat. Because of people like you, this cause carries real weight.",
      accentColor: "#E8CF63",
    };
  }
  if (amount >= 3) {
    return {
      title: "Citizen Supporter",
      impact:
        "Your contribution helps keep the campaign active, fund scientific species monitoring, and reach more people with this cause.",
      accentColor: "#38B6FF",
    };
  }
  return {
    title: "Penguin Friend",
    impact:
      "Your contribution keeps the campaign visible and adds to the defense of the Humboldt penguin. Every act of support, no matter the size, makes a difference.",
    accentColor: "#38B6FF",
  };
}

function fmtAmount(amount: number, currency: "CLP" | "USD"): string {
  if (currency === "USD") return `US$${amount}`;
  return `$${new Intl.NumberFormat("es-CL").format(amount)} CLP`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendDonationConfirmationEmail(input: DonationConfirmationInput) {
  if (!isSmtpConfigured) return;

  const siteUrl = campaignConfig.site.siteUrl;
  const supportEmail = campaignConfig.site.contactEmail;
  const isEn = input.language === "en";

  const tier = isEn ? getTierEn(input.amount) : getTierEs(input.amount, input.currency);
  const greetingName = input.donorName.trim() || (isEn ? "Hello" : "Hola");
  const amountFormatted = fmtAmount(input.amount, input.currency);

  const subject = isEn
    ? `Thank you for your donation, ${input.donorName.trim() || "friend"}! — Save the Humboldt Penguin`
    : `¡Gracias por tu donación, ${input.donorName.trim() || "amigo/a"}! — Salvemos Humboldt`;

  const receiptLine = input.receiptNumber
    ? isEn
      ? `Payment receipt: ${input.receiptNumber}`
      : `Comprobante de pago: ${input.receiptNumber}`
    : isEn
      ? "Your payment receipt will be sent directly by Flow once the transaction is complete."
      : "Tu comprobante de pago será enviado directamente por Flow al completar la transacción.";

  const text = isEn
    ? [
        `${greetingName},`,
        "",
        `We received your donation of ${amountFormatted} to the Save the Humboldt Penguin campaign.`,
        "",
        `You are a ${tier.title}.`,
        "",
        tier.impact,
        "",
        receiptLine,
        "",
        "Thank you for supporting the protection of the Humboldt penguin.",
        "",
        `Contact: ${supportEmail}`,
        "",
        "Save the Humboldt Penguin team",
        siteUrl,
      ].join("\n")
    : [
        `${greetingName},`,
        "",
        `Recibimos tu donación de ${amountFormatted} para la campaña Salvemos Humboldt.`,
        "",
        `Eres ${tier.title}.`,
        "",
        tier.impact,
        "",
        receiptLine,
        "",
        "Gracias por apoyar la protección del pingüino de Humboldt.",
        "",
        `Correo de contacto: ${supportEmail}`,
        "",
        "Equipo Salvemos Humboldt",
        siteUrl,
      ].join("\n");

  const eyebrow = isEn
    ? `${tier.title} · Donation received`
    : `${tier.title} · Donación recibida`;

  const headline = isEn
    ? `Thank you, ${escapeHtml(greetingName)}!`
    : `¡Gracias, ${escapeHtml(greetingName)}!`;

  const thankYouBody = isEn
    ? tier.impact
    : tier.impact;

  const ctaLabel = isEn ? "View the campaign" : "Ver la campaña";
  const footerTeam = isEn ? "Save the Humboldt Penguin team" : "Equipo Salvemos Humboldt";

  const html = `<!DOCTYPE html>
<html lang="${input.language}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
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
                alt="Humboldt penguin logo"
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
              <p style="margin:0 0 20px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${tier.accentColor};">
                ${escapeHtml(eyebrow)}
              </p>

              <!-- Greeting -->
              <p style="margin:0 0 8px;font-size:26px;font-weight:800;color:#ffffff;line-height:1.2;">
                ${headline}
              </p>

              <!-- Tier badge -->
              <p style="margin:0 0 24px;font-size:14px;font-weight:600;color:${tier.accentColor};">
                ${escapeHtml(tier.title)}
              </p>

              <!-- Amount pill -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:100px;padding:10px 20px;">
                    <span style="font-size:22px;font-weight:800;color:#ffffff;">${escapeHtml(amountFormatted)}</span>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr><td style="border-top:1px solid rgba(255,255,255,0.08);font-size:0;">&nbsp;</td></tr>
              </table>

              <!-- Impact -->
              <p style="margin:0 0 28px;font-size:15px;line-height:1.75;color:#a0b4c8;">
                ${escapeHtml(thankYouBody)}
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center" style="background-color:${tier.accentColor};border-radius:100px;">
                    <a href="${siteUrl}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:700;color:#05070b;text-decoration:none;letter-spacing:0.02em;">
                      ${ctaLabel}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr><td style="border-top:1px solid rgba(255,255,255,0.08);font-size:0;">&nbsp;</td></tr>
              </table>

              <!-- Receipt -->
              <p style="margin:0;font-size:13px;line-height:1.7;color:#637a8a;">
                ${escapeHtml(receiptLine)}
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:28px;">
              <p style="margin:0 0 6px;font-size:12px;color:#3d5263;">
                <strong style="color:#4d6a7a;">${footerTeam}</strong>
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
