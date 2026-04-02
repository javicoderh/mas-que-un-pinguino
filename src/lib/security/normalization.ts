const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

export const normalizeText = (value: string) => normalizeWhitespace(value).normalize("NFKC");

export const normalizeEmail = (value: string) => normalizeText(value).toLowerCase();

export const normalizeName = (value: string) => normalizeText(value)
  .toLowerCase()
  .replace(/\s+/g, " ");

export const normalizeRegion = (value: string) => normalizeText(value)
  .toLowerCase()
  .replace(/\s+/g, " ");

export const normalizeRut = (value: string) =>
  normalizeText(value).replace(/\./g, "").replace(/-/g, "").toUpperCase();

export const looksLikeRepeatedGarbage = (value: string) =>
  /(.)\1{5,}/u.test(value) || /^([a-záéíóúüñ0-9])\1+$/iu.test(value);

export const looksMeaningless = (value: string) => {
  const normalized = normalizeText(value);
  if (!normalized) return true;
  if (looksLikeRepeatedGarbage(normalized)) return true;
  return normalized.replace(/[^a-záéíóúüñ]/giu, "").length < 2;
};

export function validateRut(value: string) {
  const clean = normalizeRut(value);
  if (!/^\d{7,8}[0-9K]$/.test(clean)) return false;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  let sum = 0;
  let multiplier = 2;

  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  const expected = remainder === 11 ? "0" : remainder === 10 ? "K" : String(remainder);
  return dv === expected;
}
