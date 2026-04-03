import { isServerStorageConfigured, securityConfig } from "./config";
import { commitWrites, countCollectionDocuments, encodeWrite, getDocument } from "./firestore-rest";
import { getPublicCounterFromFirestore } from "./public-firestore";
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

  return countCollectionDocuments(securityConfig.collections.signatures, [
    { field: "status", op: "EQUAL", value: "accepted" }
  ]);
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
