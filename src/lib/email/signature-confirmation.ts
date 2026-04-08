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

  const supportEmail = campaignConfig.site.contactEmail;
  const subject =
    input.status === "accepted"
      ? "Tu firma fue registrada en Es más que un pingüino"
      : "Recibimos tu firma para Es más que un pingüino";

  const greetingName = input.fullName.trim() || "Hola";
  const statusLine =
    input.status === "accepted"
      ? "Tu firma quedó registrada para la campaña ciudadana Es más que un pingüino."
      : "Recibimos tu firma para la campaña ciudadana Es más que un pingüino y quedó en una revisión breve antes de su publicación.";

  const text = [
    `${greetingName},`,
    "",
    statusLine,
    "",
    "Gracias por sumarte a esta campaña ciudadana por la protección del pingüino de Humboldt.",
    "",
    input.rut
      ? "Si tú no realizaste esta firma, responde este correo indicando que no firmaste y escribe tu RUT para que podamos ubicar y eliminar el registro de la campaña."
      : "Si tú no realizaste esta firma, responde este correo indicando que no firmaste y menciona el país y ciudad con que aparece este registro para que podamos ubicarlo y eliminarlo.",
    "",
    `Correo de contacto: ${supportEmail}`,
    "",
    "Equipo Es más que un pingüino"
  ].join("\n");

  await sendEmail({
    to: input.email,
    subject,
    text
  });
}
