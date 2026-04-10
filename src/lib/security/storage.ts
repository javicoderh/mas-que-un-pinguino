import { securityConfig } from "./config";
import {
  commitWrites,
  encodeIncrementTransforms,
  encodeWrite,
  getDocument,
  queryCollection
} from "./firestore-rest";
import { getPublicCounterBreakdownFromFirestore } from "./public-firestore";
import { getDeclaredCountryCode } from "./visitor-origin";
import type { RiskDecision } from "./risk-score";
import type { NormalizedSignature } from "../validation/signature-schema";

export const emergencySignatureCounterFallback = {
  count: 5480,
  chileanCount: 5453,
  foreignCount: 27
} as const;

export interface SignatureCounterBreakdown {
  count: number;
  chileanCount: number;
  foreignCount: number;
}

const signatureCounterCacheTtlMs = 1000 * 60 * 10;

let signatureCounterCache:
  | {
      value: SignatureCounterBreakdown;
      expiresAt: number;
    }
  | null = null;

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

interface PublicCounterDocument {
  count?: number;
  chileanCount?: number;
  foreignCount?: number;
}

const publicCounterPath = `${securityConfig.collections.counterCollection}/${securityConfig.collections.counterDoc}`;

function getCounterFieldToIncrement(country: string) {
  return isChileanCountry(country) ? "chileanCount" : "foreignCount";
}

function hasPublicCounterFields(counter: PublicCounterDocument | null): counter is PublicCounterDocument {
  return Boolean(
    counter &&
      (counter.count !== undefined ||
        counter.chileanCount !== undefined ||
        counter.foreignCount !== undefined)
  );
}

async function getStoredPublicCounter(): Promise<PublicCounterDocument | null> {
  try {
    return await getDocument<PublicCounterDocument>(publicCounterPath);
  } catch (error) {
    console.error("stored-public-counter-read-failed", error);
    return null;
  }
}

export async function getPublicSignatureBreakdown() {
  // Both paths now read the pre-maintained counter document (1 read) instead of
  // querying the full signatures collection (N reads).
  try {
    const storedCounter = await getStoredPublicCounter();
    if (hasPublicCounterFields(storedCounter)) {
      return {
        count: Number(storedCounter.count ?? 0),
        chileanCount: Number(storedCounter.chileanCount ?? 0),
        foreignCount: Number(storedCounter.foreignCount ?? 0)
      };
    }
  } catch (error) {
    console.error("public-signature-breakdown-counter-doc-failed", error);
  }

  // Fallback: try the public Firestore REST path (also reads counter doc, 1 read)
  try {
    return await getPublicCounterBreakdownFromFirestore();
  } catch (publicError) {
    console.error("public-signature-breakdown-final-fallback", publicError);
    return emergencySignatureCounterFallback;
  }
}

export async function getCachedPublicSignatureBreakdown(
  forceRefresh = false
): Promise<SignatureCounterBreakdown> {
  if (!forceRefresh && signatureCounterCache && signatureCounterCache.expiresAt > Date.now()) {
    return signatureCounterCache.value;
  }

  const value = await getPublicSignatureBreakdown();
  signatureCounterCache = {
    value,
    expiresAt: Date.now() + signatureCounterCacheTtlMs
  };
  return value;
}

export async function storeSignature(input: StoredSignatureInput) {
  const signatureId = crypto.randomUUID();
  const signaturePath = `${securityConfig.collections.signatures}/${signatureId}`;
  const bypassReadChecks = securityConfig.bypassSignatureReadChecks;

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
  ];

  if (!bypassReadChecks) {
    writes.push(
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
    );
  }

  if (input.status === "accepted") {
    writes.push(encodeIncrementTransforms(publicCounterPath, ["count", getCounterFieldToIncrement(input.signature.country)]));
  }

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
  const writes = [
    encodeWrite(
      `${securityConfig.collections.signatures}/${params.signatureId}`,
      { ...doc, status: params.decision, updatedAtMs: now },
      true
    )
  ];

  if (doc.status !== "accepted" && params.decision === "accepted") {
    writes.push(encodeIncrementTransforms(publicCounterPath, ["count", getCounterFieldToIncrement(String(doc.country ?? ""))]));
  }

  await commitWrites(writes);
}
