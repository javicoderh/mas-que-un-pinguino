import { isServerStorageConfigured, securityConfig } from "./config";
import { commitWrites, countCollectionDocuments, encodeWrite, getDocument, queryCollection } from "./firestore-rest";
import { getPublicCounterFromFirestore } from "./public-firestore";
import { getDeclaredCountryCode } from "./visitor-origin";
import type { RiskDecision } from "./risk-score";
import type { NormalizedSignature } from "../validation/signature-schema";

export interface StoredSignatureInput {
  signature: NormalizedSignature;
  status: "pending" | "accepted" | "flagged" | "rejected";
  abuseReason: string | null;
  riskDecision: RiskDecision;
  riskReasons: string[];
  riskScore: number;
  dedupeKeys: {
    emailHash: string;
    identityHash: string;
    rutHash: string;
    ipEmailHash: string;
  };
  source: {
    ipHash: string;
    userAgentHash: string;
    fingerprintHash: string;
    submittedAtMs: number;
    originHost: string | null;
  };
  metadata: {
    tokenIssuedAtMs: number;
    submitTimeMs: number;
    captchaVerified: boolean;
    highProtectionMode: boolean;
  };
}

export async function getPublicSignatureCount() {
  if (!isServerStorageConfigured) {
    return getPublicCounterFromFirestore();
  }

  try {
    return await countCollectionDocuments(securityConfig.collections.signatures, [
      { field: "status", op: "EQUAL", value: "accepted" }
    ]);
  } catch (error) {
    console.error("signature-count-fallback", error);

    try {
      return await getPublicCounterFromFirestore();
    } catch (publicError) {
      console.error("signature-count-public-fallback-failed", publicError);
      return 0;
    }
  }
}

const likelyChileCountryTypos = new Set([
  "chule",
  "cjile",
  "chike",
  "chila",
  "chilr",
  "chilena",
  "chiie",
  "chle",
  "chole",
  "chilw"
]);

const normalizeCountryText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");

const isChileanCountry = (country: string) => {
  const normalized = normalizeCountryText(country);
  if (!normalized) return false;
  if (getDeclaredCountryCode(country) === "CL") return true;
  return likelyChileCountryTypos.has(normalized);
};

interface PublicAcceptedSignatureRow {
  id: string;
  country: string;
}

export async function getPublicSignatureBreakdown() {
  const count = await getPublicSignatureCount();

  if (!isServerStorageConfigured) {
    return {
      count,
      chileanCount: count,
      foreignCount: 0
    };
  }

  try {
    const acceptedRows = await queryCollection<PublicAcceptedSignatureRow>({
      collectionId: securityConfig.collections.signatures,
      filters: [{ field: "status", op: "EQUAL", value: "accepted" }],
      limit: 5000
    });

    let chileanCount = 0;
    let foreignCount = 0;

    for (const row of acceptedRows) {
      if (isChileanCountry(row.country ?? "")) {
        chileanCount++;
      } else {
        foreignCount++;
      }
    }

    return {
      count,
      chileanCount,
      foreignCount
    };
  } catch (error) {
    console.error("signature-breakdown-fallback", error);
    return {
      count,
      chileanCount: count,
      foreignCount: 0
    };
  }
}

export async function storeSignature(input: StoredSignatureInput) {
  const signatureId = crypto.randomUUID();
  const signaturePath = `${securityConfig.collections.signatures}/${signatureId}`;

  const writes = [
    encodeWrite(
      signaturePath,
      {
        firstName: input.signature.firstName,
        lastName: input.signature.lastName,
        fullName: input.signature.fullName,
        rut: input.signature.rut,
        email: input.signature.email,
        age: input.signature.age,
        country: input.signature.country,
        legalNature: input.signature.legalNature,
        region: input.signature.region,
        commune: input.signature.commune,
        affiliation: input.signature.affiliation,
        message: input.signature.message,
        consent: input.signature.consent,
        updates: input.signature.updates,
        status: input.status,
        abuseReason: input.abuseReason,
        riskDecision: input.riskDecision,
        riskReasons: input.riskReasons,
        riskScore: input.riskScore,
        dedupe: {
          emailHash: input.dedupeKeys.emailHash,
          identityHash: input.dedupeKeys.identityHash,
          rutHash: input.dedupeKeys.rutHash,
          ipEmailHash: input.dedupeKeys.ipEmailHash
        },
        source: {
          ipHash: input.source.ipHash,
          userAgentHash: input.source.userAgentHash,
          fingerprintHash: input.source.fingerprintHash,
          originHost: input.source.originHost,
          submittedAtMs: input.source.submittedAtMs
        },
        security: {
          tokenIssuedAtMs: input.metadata.tokenIssuedAtMs,
          submitTimeMs: input.metadata.submitTimeMs,
          captchaVerified: input.metadata.captchaVerified,
          highProtectionMode: input.metadata.highProtectionMode
        },
        createdAtMs: input.source.submittedAtMs,
        updatedAtMs: input.source.submittedAtMs,
        sourceName: "campaign-site"
      },
      false
    ),
    encodeWrite(
      `${securityConfig.collections.dedupeEmails}/${input.dedupeKeys.emailHash}`,
      {
        signatureId,
        createdAtMs: input.source.submittedAtMs
      },
      false
    ),
    encodeWrite(
      `${securityConfig.collections.dedupeIdentity}/${input.dedupeKeys.identityHash}`,
      {
        signatureId,
        createdAtMs: input.source.submittedAtMs
      },
      false
    ),
    encodeWrite(
      `${securityConfig.collections.dedupeRut}/${input.dedupeKeys.rutHash}`,
      {
        signatureId,
        createdAtMs: input.source.submittedAtMs
      },
      false
    )
  ];

  return commitWrites(writes);
}

export async function signatureExists(keys: {
  emailHash: string;
  identityHash: string;
  rutHash: string;
}) {
  const [emailDoc, identityDoc, rutDoc] = await Promise.all([
    getDocument(`${securityConfig.collections.dedupeEmails}/${keys.emailHash}`),
    getDocument(`${securityConfig.collections.dedupeIdentity}/${keys.identityHash}`),
    getDocument(`${securityConfig.collections.dedupeRut}/${keys.rutHash}`)
  ]);

  return Boolean(emailDoc || identityDoc || rutDoc);
}

export async function getDuplicateMatch(keys: {
  emailHash: string;
  identityHash: string;
  rutHash: string;
}) {
  const [emailDoc, identityDoc, rutDoc] = await Promise.all([
    getDocument(`${securityConfig.collections.dedupeEmails}/${keys.emailHash}`),
    getDocument(`${securityConfig.collections.dedupeIdentity}/${keys.identityHash}`),
    getDocument(`${securityConfig.collections.dedupeRut}/${keys.rutHash}`)
  ]);

  return {
    email: Boolean(emailDoc),
    identity: Boolean(identityDoc),
    rut: Boolean(rutDoc),
    any: Boolean(emailDoc || identityDoc || rutDoc)
  };
}

export interface FlaggedSignatureRecord {
  id: string;
  fullName: string;
  country: string;
  region: string;
  commune: string;
  legalNature: string;
  affiliation: string;
  status: string;
  riskScore: number;
  riskReasons: string[];
  createdAtMs: number;
  submittedAtMs?: number;
}

export async function listFlaggedSignatures(page = 1, pageSize = 20): Promise<FlaggedSignatureRecord[]> {
  const rows = await queryCollection<FlaggedSignatureRecord>({
    collectionId: securityConfig.collections.signatures,
    filters: [{ field: "status", op: "EQUAL", value: "flagged" }],
    orderBy: [{ field: "createdAtMs", direction: "DESCENDING" }],
    limit: pageSize,
    offset: (page - 1) * pageSize
  });
  return rows;
}

export async function reviewFlaggedSignature(params: {
  signatureId: string;
  decision: "accepted" | "rejected";
}): Promise<void> {
  const doc = await getDocument<Record<string, unknown>>(
    `${securityConfig.collections.signatures}/${params.signatureId}`
  );
  if (!doc) throw new Error("signature-not-found");

  const now = Date.now();
  await commitWrites([
    encodeWrite(
      `${securityConfig.collections.signatures}/${params.signatureId}`,
      { ...doc, status: params.decision, updatedAtMs: now },
      true
    )
  ]);
}
