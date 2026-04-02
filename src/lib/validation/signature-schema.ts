import { z } from "zod";
import {
  looksLikeRepeatedGarbage,
  looksMeaningless,
  normalizeEmail,
  normalizeName,
  normalizeRegion,
  normalizeRut,
  normalizeText,
  validateRut
} from "../security/normalization";

const trimmedString = (max: number) =>
  z
    .string()
    .transform((value) => normalizeText(value))
    .refine((value) => value.length <= max, "El valor excede el largo permitido.");

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .optional()
    .transform((value) => normalizeText(value ?? ""))
    .refine((value) => value.length <= max, "El valor excede el largo permitido.");

export const signatureSchema = z
  .object({
    firstName: trimmedString(60),
    lastName: trimmedString(80),
    rut: trimmedString(16),
    email: trimmedString(120),
    region: trimmedString(80),
    commune: trimmedString(80),
    affiliation: optionalTrimmedString(120),
    message: optionalTrimmedString(500),
    consent: z.boolean(),
    updates: z.boolean()
  })
  .superRefine((value, context) => {
    const namePattern = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]{2,}$/u;
    const placePattern = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9'()., -]{2,}$/u;

    if (!namePattern.test(value.firstName) || looksMeaningless(value.firstName)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["firstName"],
        message: "Ingresa un nombre válido."
      });
    }

    if (!namePattern.test(value.lastName) || looksMeaningless(value.lastName)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lastName"],
        message: "Ingresa un apellido válido."
      });
    }

    if (!validateRut(value.rut)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rut"],
        message: "Ingresa un RUT chileno válido."
      });
    }

    if (!z.string().email().safeParse(normalizeEmail(value.email)).success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Ingresa un correo válido."
      });
    }

    if (!placePattern.test(value.region) || looksMeaningless(value.region)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["region"],
        message: "Ingresa una región válida."
      });
    }

    if (!placePattern.test(value.commune) || looksMeaningless(value.commune)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["commune"],
        message: "Ingresa una comuna válida."
      });
    }

    if (value.affiliation && !/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9.,'()\-\/\s]+$/u.test(value.affiliation)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["affiliation"],
        message: "La organización contiene caracteres no permitidos."
      });
    }

    if (value.message && looksLikeRepeatedGarbage(value.message)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["message"],
        message: "El mensaje parece inválido."
      });
    }

    if (!value.consent) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["consent"],
        message: "Debes aceptar el consentimiento para firmar."
      });
    }
  });

export type SignatureInput = z.infer<typeof signatureSchema>;

export interface NormalizedSignature {
  firstName: string;
  lastName: string;
  fullName: string;
  rut: string;
  email: string;
  region: string;
  commune: string;
  affiliation: string;
  message: string;
  consent: boolean;
  updates: boolean;
  normalized: {
    email: string;
    rut: string;
    fullName: string;
    region: string;
    identity: string;
  };
}

export function parseSignaturePayload(raw: Record<string, unknown>): NormalizedSignature {
  const parsed = signatureSchema.parse(raw);
  const normalizedFirstName = normalizeText(parsed.firstName);
  const normalizedLastName = normalizeText(parsed.lastName);
  const normalizedRegion = normalizeRegion(parsed.region);

  return {
    firstName: normalizedFirstName,
    lastName: normalizedLastName,
    fullName: `${normalizedFirstName} ${normalizedLastName}`.trim(),
    rut: normalizeRut(parsed.rut),
    email: normalizeEmail(parsed.email),
    region: normalizeText(parsed.region),
    commune: normalizeText(parsed.commune),
    affiliation: normalizeText(parsed.affiliation ?? ""),
    message: normalizeText(parsed.message ?? ""),
    consent: parsed.consent,
    updates: parsed.updates,
    normalized: {
      email: normalizeEmail(parsed.email),
      rut: normalizeRut(parsed.rut),
      fullName: normalizeName(`${parsed.firstName} ${parsed.lastName}`),
      region: normalizedRegion,
      identity: `${normalizeName(`${parsed.firstName} ${parsed.lastName}`)}|${normalizedRegion}`
    }
  };
}
