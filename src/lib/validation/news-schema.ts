import { z } from "zod";
import { looksLikeRepeatedGarbage, looksMeaningless, normalizeText } from "../security/normalization";

const trimmedString = (max: number) =>
  z
    .string()
    .transform((value) => normalizeText(value))
    .refine((value) => value.length <= max, "El valor excede el largo permitido.");

export const newsCreateSchema = z
  .object({
    title: trimmedString(120),
    body: trimmedString(2000)
  })
  .superRefine((value, context) => {
    if (value.title.length < 4 || looksMeaningless(value.title)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["title"],
        message: "Ingresa un título válido."
      });
    }

    if (value.body.length < 20 || looksLikeRepeatedGarbage(value.body)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body"],
        message: "Ingresa un texto más claro para la noticia."
      });
    }
  });

export const newsUpdateSchema = z.object({
  title: trimmedString(120),
  body: trimmedString(2000),
  preference: z.coerce.number().int().min(0).max(9999)
});

export type NewsCreateInput = z.infer<typeof newsCreateSchema>;
export type NewsUpdateInput = z.infer<typeof newsUpdateSchema>;

export function parseNewsCreatePayload(raw: Record<string, unknown>) {
  const parsed = newsCreateSchema.parse(raw);
  return {
    title: normalizeText(parsed.title),
    body: normalizeText(parsed.body)
  };
}

export function parseNewsUpdatePayload(raw: Record<string, unknown>) {
  const parsed = newsUpdateSchema.parse(raw);
  return {
    title: normalizeText(parsed.title),
    body: normalizeText(parsed.body),
    preference: parsed.preference
  };
}
