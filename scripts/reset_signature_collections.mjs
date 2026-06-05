#!/usr/bin/env node
import { readFileSync } from "fs";
import crypto from "crypto";

const REQUEST_TIMEOUT_MS = 15_000;
const BATCH_SIZE = 200;

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

const config = {
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
    counterCollection: env.PUBLIC_FIREBASE_COUNTER_COLLECTION ?? "public_stats",
    counterDoc: env.PUBLIC_FIREBASE_COUNTER_DOC ?? "signatures_counter",
  },
};

if (
  !config.firestore.projectId ||
  !config.firestore.clientEmail ||
  !config.firestore.privateKey
) {
  throw new Error("Missing required Firestore service account environment variables.");
}

const firestoreBaseUrl = () =>
  `https://firestore.googleapis.com/v1/projects/${config.firestore.projectId}/databases/(default)`;
const firestoreDocumentRoot = () =>
  `projects/${config.firestore.projectId}/databases/(default)/documents`;
const oauthAudience = "https://oauth2.googleapis.com/token";
const firestoreScope = "https://www.googleapis.com/auth/datastore";

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
  if (typeof value === "number") return { integerValue: String(value) };
  return {
    mapValue: {
      fields: Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, encodeFirestoreValue(item)])
      ),
    },
  };
};

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function buildJwt() {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = toBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claimSet = toBase64Url(
    JSON.stringify({
      iss: config.firestore.clientEmail,
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
      config.firestore.privateKey.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""),
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

async function listCollectionDocumentNames(collectionId) {
  const names = [];
  let pageToken = "";

  while (true) {
    const qs = new URLSearchParams({ pageSize: "500" });
    if (pageToken) qs.set("pageToken", pageToken);
    const response = await firestoreFetch(`/documents/${collectionId}?${qs.toString()}`, {
      method: "GET",
    });
    if (response.status === 404) return names;
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`list-failed:${collectionId}:${response.status}:${text}`);
    }
    const payload = await response.json();
    for (const doc of payload.documents ?? []) {
      names.push(doc.name);
    }
    pageToken = payload.nextPageToken ?? "";
    if (!pageToken) break;
  }

  return names;
}

async function commitWrites(writes) {
  const response = await firestoreFetch("/documents:commit", {
    method: "POST",
    body: JSON.stringify({ writes }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`commit-failed:${response.status}:${text}`);
  }
  return response.json();
}

async function deleteDocuments(documentNames) {
  for (let i = 0; i < documentNames.length; i += BATCH_SIZE) {
    const batch = documentNames.slice(i, i + BATCH_SIZE);
    await commitWrites(batch.map((name) => ({ delete: name })));
  }
}

async function resetCounter() {
  await commitWrites([
    {
      update: {
        name: `${firestoreDocumentRoot()}/${config.collections.counterCollection}/${config.collections.counterDoc}`,
        fields: {
          count: encodeFirestoreValue(0),
          updatedAtMs: encodeFirestoreValue(Date.now()),
        },
      },
    },
  ]);
}

async function main() {
  const targetCollections = [
    config.collections.signatures,
    config.collections.dedupeEmails,
    config.collections.dedupeIdentity,
    config.collections.dedupeRut,
  ];

  const listed = await Promise.all(
    targetCollections.map(async (collectionId) => ({
      collectionId,
      names: await listCollectionDocumentNames(collectionId),
    }))
  );

  for (const entry of listed) {
    await deleteDocuments(entry.names);
  }

  await resetCounter();

  console.log(
    JSON.stringify(
      {
        deleted: Object.fromEntries(listed.map((entry) => [entry.collectionId, entry.names.length])),
        counterResetTo: 0,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
