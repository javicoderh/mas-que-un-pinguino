import type { AstroCookies } from "astro";
import { countries } from "../countries";

export type SignatureVariant = "cl" | "intl";

export const visitorOriginCookieName = "visitor_origin";
export const visitorCountryCookieName = "visitor_country_code";
const visitorCookieMaxAgeSeconds = 60 * 60 * 24 * 7;

const normalizeCountryText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");

const countryAliases = new Map<string, string>(
  countries.flatMap((country) => [
    [normalizeCountryText(country.code), country.code],
    [normalizeCountryText(country.name), country.code]
  ])
);

countryAliases.set("eeuu", "US");
countryAliases.set("estadosunidosdeamerica", "US");
countryAliases.set("usa", "US");
countryAliases.set("unitedstates", "US");
countryAliases.set("unitedstatesofamerica", "US");
countryAliases.set("uk", "GB");
countryAliases.set("england", "GB");
countryAliases.set("brasil", "BR");
countryAliases.set("republicadelcongo", "CG");
countryAliases.set("republicademocraticadelcongo", "CD");
countryAliases.set("holanda", "NL");

const normalizeCountryCode = (value: string | null | undefined) => {
  const normalized = (value ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
};

export function getDetectedCountryCode(headers: Headers) {
  const candidates = [
    headers.get("x-vercel-ip-country"),
    headers.get("cf-ipcountry"),
    headers.get("x-country-code"),
    headers.get("x-appengine-country")
  ];

  for (const candidate of candidates) {
    const normalized = normalizeCountryCode(candidate);
    if (normalized) return normalized;
  }

  return null;
}

export function getDeclaredCountryCode(country: string) {
  return countryAliases.get(normalizeCountryText(country)) ?? null;
}

export function getCountryIpConsistency(input: {
  declaredCountry: string;
  detectedCountryCode: string | null;
}) {
  const declaredCountryCode = getDeclaredCountryCode(input.declaredCountry);

  return {
    declaredCountryCode,
    isConsistent:
      Boolean(declaredCountryCode) &&
      Boolean(input.detectedCountryCode) &&
      declaredCountryCode === input.detectedCountryCode
  };
}

export function getSignatureVariantFromCountryCode(countryCode: string | null): SignatureVariant {
  return countryCode === "CL" ? "cl" : countryCode ? "intl" : "cl";
}

export function getSignatureVariantFromCookies(cookies: AstroCookies): SignatureVariant | null {
  const value = cookies.get(visitorOriginCookieName)?.value;
  return value === "cl" || value === "intl" ? value : null;
}

export function getDetectedCountryCodeFromCookies(cookies: AstroCookies) {
  return normalizeCountryCode(cookies.get(visitorCountryCookieName)?.value);
}

export function setVisitorOriginCookies(
  cookies: AstroCookies,
  input: { signatureVariant: SignatureVariant; detectedCountryCode: string | null }
) {
  cookies.set(visitorOriginCookieName, input.signatureVariant, {
    path: "/",
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: "lax",
    maxAge: visitorCookieMaxAgeSeconds
  });

  if (input.detectedCountryCode) {
    cookies.set(visitorCountryCookieName, input.detectedCountryCode, {
      path: "/",
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: "lax",
      maxAge: visitorCookieMaxAgeSeconds
    });
  }
}
