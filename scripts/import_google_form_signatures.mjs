#!/usr/bin/env node
import { readFileSync } from "fs";
import crypto from "crypto";
import process from "process";

const args = new Set(process.argv.slice(2));
const dryRun = !args.has("--write");
const REQUEST_TIMEOUT_MS = 15_000;
const CONCURRENCY = 8;
const RETRIES = 3;

const ROOT_INPUT = "generated/google_form_import.json";

function loadEnv(path = ".env") {
  const env = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const i = rawLine.indexOf("=");
    if (i === -1) continue;
    const key = rawLine.slice(0, i);
    let value = rawLine.slice(i + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = loadEnv();

const securityConfig = {
  hashSecret: env.SECURITY_HASH_SECRET ?? "",
  firestore: {
    projectId:
      env.FIREBASE_SERVICE_ACCOUNT_PROJECT_ID ??
      env.GOOGLE_CLOUD_PROJECT ??
      env.PUBLIC_FIREBASE_PROJECT_ID ??
      "",
    clientEmail: env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL ?? "",
    privateKey: (env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  },
  collections: {
    signatures: env.FIREBASE_SIGNATURES_COLLECTION ?? "campaign_signatures",
    dedupeEmails: env.FIREBASE_SIGNATURES_DEDUPE_EMAIL_COLLECTION ?? "signature_dedupe_email",
    dedupeIdentity:
      env.FIREBASE_SIGNATURES_DEDUPE_IDENTITY_COLLECTION ?? "signature_dedupe_identity",
    dedupeRut: env.FIREBASE_SIGNATURES_DEDUPE_RUT_COLLECTION ?? "signature_dedupe_rut",
  },
};

if (
  !securityConfig.hashSecret ||
  !securityConfig.firestore.projectId ||
  !securityConfig.firestore.clientEmail ||
  !securityConfig.firestore.privateKey
) {
  throw new Error("Missing required security/firestore environment variables.");
}

const firestoreBaseUrl = () =>
  `https://firestore.googleapis.com/v1/projects/${securityConfig.firestore.projectId}/databases/(default)`;
const firestoreDocumentRoot = () =>
  `projects/${securityConfig.firestore.projectId}/databases/(default)/documents`;
const oauthAudience = "https://oauth2.googleapis.com/token";
const firestoreScope = "https://www.googleapis.com/auth/datastore";

const normalizeText = (value) => value.replace(/\s+/g, " ").trim().normalize("NFKC");
const normalizeEmail = (value) => normalizeText(value).toLowerCase();
const normalizeName = (value) => normalizeText(value).toLowerCase().replace(/\s+/g, " ");
const normalizeRegion = (value) => normalizeText(value).toLowerCase().replace(/\s+/g, " ");
const normalizeRut = (value) => normalizeText(value).replace(/\./g, "").replace(/-/g, "").toUpperCase();

const toBase64Url = (value) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const encodeFirestoreValue = (value) => {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map((item) => encodeFirestoreValue(item)) } };
  }
  return {
    mapValue: {
      fields: Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, encodeFirestoreValue(item)])
      ),
    },
  };
};

const encodeDocumentFields = (data) =>
  Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encodeFirestoreValue(value)]));

const documentPath = (relativePath) => `${firestoreDocumentRoot()}/${relativePath}`;

const hmacSha256Base64Url = async (secret, value) => {
  const key = await crypto.webcrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.webcrypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return toBase64Url(new Uint8Array(signature));
};

const sha256Hex = async (value) => {
  const digest = await crypto.webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const hashWithSecret = async (secret, ...parts) => {
  const normalized = parts.map((part) => part ?? "").join("|");
  return sha256Hex(`${secret}:${normalized}`);
};

async function buildJwt() {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = toBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claimSet = toBase64Url(
    JSON.stringify({
      iss: securityConfig.firestore.clientEmail,
      scope: firestoreScope,
      aud: oauthAudience,
      exp: nowSeconds + 3600,
      iat: nowSeconds,
    })
  );
  const unsigned = `${header}.${claimSet}`;
  const key = await crypto.webcrypto.subtle.importKey(
    "pkcs8",
    Buffer.from(
      securityConfig.firestore.privateKey.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""),
      "base64"
    ),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.webcrypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );
  return `${unsigned}.${Buffer.from(signature).toString("base64url")}`;
}

let cachedToken = null;
async function getAccessToken() {
  if (cachedToken?.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const assertion = await buildJwt();
  const response = await fetchWithTimeout(oauthAudience, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`oauth-token-failed:${response.status}:${JSON.stringify(payload)}`);
  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + Number(payload.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

async function firestoreFetch(path, init = {}) {
  const token = await getAccessToken();
  return fetchWithTimeout(`${firestoreBaseUrl()}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function fetchWithTimeout(url, init = {}) {
  let lastError;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      lastError = error?.name === "AbortError"
        ? new Error(`request-timeout:${REQUEST_TIMEOUT_MS}:${url}`)
        : error;
      if (attempt === RETRIES) throw lastError;
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

async function getDocument(relativePath) {
  const response = await firestoreFetch(`/documents/${relativePath}`, { method: "GET" });
  if (response.status === 404) return null;
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`firestore-get-failed:${response.status}:${text}`);
  }
  return response.json();
}

async function commitWrites(writes) {
  const response = await firestoreFetch("/documents:commit", {
    method: "POST",
    body: JSON.stringify({ writes }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`firestore-commit-failed:${response.status}:${text}`);
  }
  return response.json();
}

const encodeWrite = (relativePath, data, exists) => ({
  update: {
    name: documentPath(relativePath),
    fields: encodeDocumentFields(data),
  },
  currentDocument: exists === undefined ? undefined : { exists },
});

async function buildSignatureDedupeKeys(input) {
  return {
    emailHash: await hashWithSecret(securityConfig.hashSecret, "email", input.normalizedEmail),
    identityHash: await hashWithSecret(securityConfig.hashSecret, "identity", input.normalizedIdentity),
    rutHash: await hashWithSecret(securityConfig.hashSecret, "rut", input.normalizedRut),
    ipEmailHash: await hashWithSecret(
      securityConfig.hashSecret,
      "ip_email",
      input.ipHash,
      input.normalizedEmail
    ),
  };
}

function toNormalizedSignature(raw) {
  const firstName = normalizeText(raw.firstName);
  const lastName = normalizeText(raw.lastName);
  const region = normalizeText(raw.region);
  return {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    rut: normalizeRut(raw.rut),
    email: normalizeEmail(raw.email),
    age: Number(raw.age),
    country: normalizeText(raw.country),
    legalNature: normalizeText(raw.legalNature),
    region,
    commune: normalizeText(raw.commune),
    affiliation: normalizeText(raw.affiliation ?? ""),
    message: normalizeText(raw.message ?? ""),
    consent: Boolean(raw.consent),
    updates: Boolean(raw.updates),
    normalized: {
      email: normalizeEmail(raw.email),
      rut: normalizeRut(raw.rut),
      fullName: normalizeName(`${raw.firstName} ${raw.lastName}`),
      region: normalizeRegion(raw.region),
      identity: `${normalizeName(`${raw.firstName} ${raw.lastName}`)}|${normalizeRegion(raw.region)}`,
    },
  };
}

async function getDuplicateMatch(keys) {
  const [emailDoc, identityDoc, rutDoc] = await Promise.all([
    getDocument(`${securityConfig.collections.dedupeEmails}/${keys.emailHash}`),
    getDocument(`${securityConfig.collections.dedupeIdentity}/${keys.identityHash}`),
    getDocument(`${securityConfig.collections.dedupeRut}/${keys.rutHash}`),
  ]);
  return {
    email: Boolean(emailDoc),
    identity: Boolean(identityDoc),
    rut: Boolean(rutDoc),
    any: Boolean(emailDoc || identityDoc || rutDoc),
  };
}

async function importRow(item) {
  const signature = toNormalizedSignature(item);
  const submittedAtMs = Date.now();
  const ipHash = await hashWithSecret(securityConfig.hashSecret, "ip", "google-form-import");
  const userAgentHash = await hashWithSecret(
    securityConfig.hashSecret,
    "ua",
    "google-form-import-script"
  );
  const fingerprintHash = await hashWithSecret(
    securityConfig.hashSecret,
    "fp",
    "google-form-import",
    signature.email,
    signature.rut
  );
  const dedupeKeys = await buildSignatureDedupeKeys({
    normalizedEmail: signature.normalized.email,
    normalizedIdentity: signature.normalized.identity,
    normalizedRut: signature.normalized.rut,
    ipHash,
  });

  const duplicate = await getDuplicateMatch(dedupeKeys);
  if (duplicate.any) {
    return { action: "skipped_duplicate", duplicate, signature };
  }

  const signatureId = crypto.randomUUID();
  const writes = [
    encodeWrite(
      `${securityConfig.collections.signatures}/${signatureId}`,
      {
        firstName: signature.firstName,
        lastName: signature.lastName,
        fullName: signature.fullName,
        rut: signature.rut,
        email: signature.email,
        age: signature.age,
        country: signature.country,
        legalNature: signature.legalNature,
        region: signature.region,
        commune: signature.commune,
        affiliation: signature.affiliation,
        message: signature.message,
        consent: signature.consent,
        updates: signature.updates,
        status: "accepted",
        abuseReason: null,
        riskDecision: "allow",
        riskReasons: [],
        riskScore: 0,
        dedupe: {
          emailHash: dedupeKeys.emailHash,
          identityHash: dedupeKeys.identityHash,
          rutHash: dedupeKeys.rutHash,
          ipEmailHash: dedupeKeys.ipEmailHash,
        },
        source: {
          ipHash,
          userAgentHash,
          fingerprintHash,
          originHost: "google-form-import",
          submittedAtMs,
        },
        security: {
          tokenIssuedAtMs: submittedAtMs,
          submitTimeMs: 0,
          captchaVerified: false,
          highProtectionMode: false,
        },
        createdAtMs: submittedAtMs,
        updatedAtMs: submittedAtMs,
        sourceName: "google-form-import",
        importMeta: {
          syntheticEmail: true,
          syntheticRegion: true,
          syntheticCommune: true,
          syntheticMessage: true,
        },
      },
      false
    ),
    encodeWrite(
      `${securityConfig.collections.dedupeEmails}/${dedupeKeys.emailHash}`,
      { signatureId, createdAtMs: submittedAtMs },
      false
    ),
    encodeWrite(
      `${securityConfig.collections.dedupeIdentity}/${dedupeKeys.identityHash}`,
      { signatureId, createdAtMs: submittedAtMs },
      false
    ),
    encodeWrite(
      `${securityConfig.collections.dedupeRut}/${dedupeKeys.rutHash}`,
      { signatureId, createdAtMs: submittedAtMs },
      false
    ),
  ];

  if (!dryRun) {
    await commitWrites(writes);
  }

  return { action: dryRun ? "would_import" : "imported", signatureId, signature };
}

async function main() {
  const rows = JSON.parse(readFileSync(ROOT_INPUT, "utf8"));
  const summary = {
    mode: dryRun ? "dry-run" : "write",
    totalRows: rows.length,
    wouldImport: 0,
    imported: 0,
    skippedDuplicate: 0,
    errors: 0,
    details: [],
  };

  for (let index = 0; index < rows.length; index += CONCURRENCY) {
    const batch = rows.slice(index, index + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (item) => {
        const result = await importRow(item);
        return { item, result };
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { item, result: rowResult } = result.value;
        summary.details.push({
          sourceRow: item.sourceRow,
          action: rowResult.action,
          rut: rowResult.signature.rut,
          email: rowResult.signature.email,
        });
        if (rowResult.action === "would_import") summary.wouldImport += 1;
        else if (rowResult.action === "imported") summary.imported += 1;
        else if (rowResult.action === "skipped_duplicate") summary.skippedDuplicate += 1;
        continue;
      }

      summary.errors += 1;
      summary.details.push({
        sourceRow: batch[results.indexOf(result)]?.sourceRow ?? null,
        action: "error",
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
