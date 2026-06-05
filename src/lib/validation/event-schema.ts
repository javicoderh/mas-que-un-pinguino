import { z } from "zod";
import { regionOptions, normalizeRegionKey } from "../events/chile-regions";
import { looksLikeRepeatedGarbage, looksMeaningless, normalizeText } from "../security/normalization";

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

const optionalUrl = z
  .string()
  .optional()
  .transform((v) => (v ?? "").trim())
  .refine((v) => v === "" || /^https?:\/\/.{4,}/.test(v), "Ingresa una URL válida (debe comenzar con http:// o https://)");

const eventImageSchema = z
  .string()
  .url("Debes ingresar una URL válida para la imagen.")
  .refine((value) => /^https?:\/\//.test(value), "La URL de imagen debe comenzar con http o https.");

export const eventSubmissionSchema = z
  .object({
    title: trimmedString(90),
    description: trimmedString(600),
    imageUrl: eventImageSchema.transform((value) => normalizeText(value)),
    link: optionalUrl,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Debes ingresar una fecha válida."),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Debes ingresar una hora válida."),
    region: trimmedString(80),
    venue: trimmedString(160),
    organizerName: optionalTrimmedString(80),
    organizerEmail: optionalTrimmedString(120),
    consent: z.boolean()
  })
  .superRefine((value, context) => {
    const titlePattern = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9'".,()\-:/&\s]{4,}$/u;
    const textPattern = /^[\s\S]{20,600}$/u;
    const placePattern = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9'".,()\-:/#&\s]{4,}$/u;

    if (!titlePattern.test(value.title) || looksMeaningless(value.title)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["title"],
        message: "Ingresa un nombre de evento válido."
      });
    }

    if (!textPattern.test(value.description) || looksLikeRepeatedGarbage(value.description)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["description"],
        message: "Describe el evento con un texto claro y más específico."
      });
    }

    if (!placePattern.test(value.venue) || looksMeaningless(value.venue)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["venue"],
        message: "Ingresa una ubicación válida."
      });
    }

    if (!regionOptions.some((item) => normalizeRegionKey(item) === normalizeRegionKey(value.region))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["region"],
        message: "Selecciona una región válida de Chile."
      });
    }

    const eventDate = new Date(`${value.date}T${value.time}:00`);
    if (!Number.isFinite(eventDate.getTime())) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["date"],
        message: "La fecha u hora del evento no es válida."
      });
    }

    if (value.organizerEmail && !z.string().email().safeParse(value.organizerEmail).success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["organizerEmail"],
        message: "Ingresa un correo de contacto válido."
      });
    }

    if (!value.consent) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["consent"],
        message: "Debes aceptar el tratamiento de datos para enviar la propuesta."
      });
    }
  });

export type EventSubmissionInput = z.infer<typeof eventSubmissionSchema>;

export interface NormalizedEventSubmission {
  title: string;
  description: string;
  imageUrl: string;
  link: string;
  date: string;
  time: string;
  region: string;
  regionKey: string;
  venue: string;
  organizerName: string;
  organizerEmail: string;
  consent: boolean;
  normalized: {
    dedupe: string;
  };
}

export function parseEventSubmissionPayload(raw: Record<string, unknown>): NormalizedEventSubmission {
  const parsed = eventSubmissionSchema.parse(raw);
  const title = normalizeText(parsed.title);
  const venue = normalizeText(parsed.venue);
  const region = regionOptions.find(
    (item) => normalizeRegionKey(item) === normalizeRegionKey(parsed.region)
  ) ?? normalizeText(parsed.region);
  const regionKey = normalizeRegionKey(region);
  const organizerEmail = normalizeText(parsed.organizerEmail ?? "").toLowerCase();

  return {
    title,
    description: normalizeText(parsed.description),
    imageUrl: normalizeText(parsed.imageUrl),
    link: parsed.link ?? "",
    date: parsed.date,
    time: parsed.time,
    region,
    regionKey,
    venue,
    organizerName: normalizeText(parsed.organizerName ?? ""),
    organizerEmail,
    consent: parsed.consent,
    normalized: {
      dedupe: `${normalizeText(title).toLowerCase()}|${parsed.date}|${regionKey}|${normalizeText(venue).toLowerCase()}`
    }
  };
}
