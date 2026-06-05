import { getPostgres, recordPostgresReadEvent, withPostgres, isPostgresAvailable } from "../db/postgres";
import { isPublicFirestoreConfigured, securityConfig } from "./config";
import {
  countCollectionDocuments,
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
  count: 18458,
  chileanCount: 18202,
  foreignCount: 256
} as const;

// Firmas históricas respaldadas de la antigua base Neon (borrada): no se leen en
// vivo pero existen, así que se suman como offset fijo. Calibrado para que el total
// público sea 18458 (18202 chilenas + 256 extranjeras) sobre los contadores vivos
// actuales de Firestore + Supabase.
const publicCounterMigrationAdjustment = {
  count: 12697,
  chileanCount: 12469,
  foreignCount: 228
} as const;

export interface SignatureCounterBreakdown {
  count: number;
  chileanCount: number;
  foreignCount: number;
}

const signatureCounterCacheTtlMs = 1000 * 60 * 10;
const counterSourceReadTimeoutMs = 8_000;

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

function addCounterBreakdowns(
  ...counters: Array<Partial<SignatureCounterBreakdown> | null | undefined>
): SignatureCounterBreakdown {
  return counters.reduce<SignatureCounterBreakdown>(
    (total, counter) => ({
      count: total.count + Number(counter?.count ?? 0),
      chileanCount: total.chileanCount + Number(counter?.chileanCount ?? 0),
      foreignCount: total.foreignCount + Number(counter?.foreignCount ?? 0)
    }),
    { count: 0, chileanCount: 0, foreignCount: 0 }
  );
}

function mergePublicCounterSources(counter: Partial<SignatureCounterBreakdown> | null): SignatureCounterBreakdown {
  return {
    count: publicCounterMigrationAdjustment.count + Number(counter?.count ?? 0),
    chileanCount: publicCounterMigrationAdjustment.chileanCount + Number(counter?.chileanCount ?? 0),
    foreignCount: publicCounterMigrationAdjustment.foreignCount + Number(counter?.foreignCount ?? 0)
  };
}

async function readCounterSourceWithTimeout<T>(
  source: string,
  read: () => Promise<T | null>
): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      read(),
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => {
          console.error(`public-signature-breakdown-${source}-timeout`);
          resolve(null);
        }, counterSourceReadTimeoutMs);
      })
    ]);
  } catch (error) {
    console.error(`public-signature-breakdown-${source}-failed`, error);
    return null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function invalidateSignatureCounterCache() {
  signatureCounterCache = null;
}

function setSignatureCounterCache(value: SignatureCounterBreakdown) {
  signatureCounterCache = {
    value,
    expiresAt: Date.now() + signatureCounterCacheTtlMs
  };
}

async function recordCounterReadEvent(readKind: "cache_hit" | "cache_miss" | "db_read") {
  if (!isPostgresAvailable) return;

  try {
    await recordPostgresReadEvent("public_counter", readKind);
  } catch (error) {
    console.error("counter-read-event-write-failed", error);
  }
}

function bumpSignatureCounterCache(country: string) {
  if (!signatureCounterCache) return;
  const nextValue = {
    count: signatureCounterCache.value.count + 1,
    chileanCount: signatureCounterCache.value.chileanCount,
    foreignCount: signatureCounterCache.value.foreignCount
  };

  if (isChileanCountry(country)) {
    nextValue.chileanCount += 1;
  } else {
    nextValue.foreignCount += 1;
  }

  setSignatureCounterCache(nextValue);
}

export function bumpForeignSignatureCounterCache() {
  if (!signatureCounterCache) return;
  setSignatureCounterCache({
    count: signatureCounterCache.value.count + 1,
    chileanCount: signatureCounterCache.value.chileanCount,
    foreignCount: signatureCounterCache.value.foreignCount + 1
  });
}

async function getStoredPublicCounter(): Promise<PublicCounterDocument | null> {
  if (isPostgresAvailable) {
    try {
      void recordCounterReadEvent("db_read");
      const sql = getPostgres();
      const [counterRows, foreignRows] = await Promise.all([
        sql`
          select count, chilean_count, foreign_count
          from signature_counter
          where counter_key = 'public'
          limit 1
        `,
        sql`
          select count(*)::int as total
          from foreign_signatures
          where status = 'accepted'
        `
      ]);
      const counter = counterRows[0];
      if (!counter) return null;
      const foreignFormCount = Number(foreignRows[0]?.total ?? 0);
      return {
        count: Number(counter.count ?? 0) + foreignFormCount,
        chileanCount: Number(counter.chilean_count ?? 0),
        foreignCount: Number(counter.foreign_count ?? 0) + foreignFormCount
      };
    } catch (error) {
      console.error("stored-public-counter-postgres-read-failed", error);
    }
  }

  return null;
}

export async function getPublicCounterReadStats() {
  if (isPostgresAvailable) {
    const rows = await withPostgres((sql) => sql`
      select
        count(*) filter (where source = 'public_counter' and read_kind = 'db_read')::int as public_counter_db_reads,
        count(*) filter (where read_kind = 'cache_hit')::int as cache_hits,
        count(*) filter (where read_kind = 'cache_miss')::int as cache_misses,
        count(*) filter (where read_kind = 'db_read')::int as db_reads,
        count(*)::int as total_events,
        max(read_at_ms) as last_read_at_ms
      from counter_read_events
    `);
    const sourceRows = await withPostgres((sql) => sql`
      select source, count(*)::int as total
      from counter_read_events
      where read_kind = 'db_read'
      group by source
      order by total desc, source asc
    `);

    return {
      totalReads: Number(rows[0]?.db_reads ?? 0),
      publicCounterReads: Number(rows[0]?.public_counter_db_reads ?? 0),
      cacheHits: Number(rows[0]?.cache_hits ?? 0),
      cacheMisses: Number(rows[0]?.cache_misses ?? 0),
      totalEvents: Number(rows[0]?.total_events ?? 0),
      lastReadAtMs: rows[0]?.last_read_at_ms ? Number(rows[0].last_read_at_ms) : null,
      readsBySource: sourceRows.map((row) => ({
        source: String(row.source ?? "unknown"),
        total: Number(row.total ?? 0)
      }))
    };
  }

  return {
    totalReads: 0,
    publicCounterReads: 0,
    cacheHits: 0,
    cacheMisses: 0,
    totalEvents: 0,
    lastReadAtMs: null,
    readsBySource: []
  };
}

async function findDuplicateInSignatures(keys: {
  emailHash: string;
  identityHash: string;
  rutHash: string;
}) {
  if (isPostgresAvailable) {
    await recordPostgresReadEvent("signature_dedupe");
    const rows = await withPostgres((sql) => sql`
      select
        exists(select 1 from signatures where dedupe_email_hash = ${keys.emailHash}) as email,
        exists(select 1 from signatures where dedupe_identity_hash = ${keys.identityHash}) as identity,
        exists(select 1 from signatures where dedupe_rut_hash = ${keys.rutHash}) as rut
    `);
    return {
      email: Boolean(rows[0]?.email),
      identity: Boolean(rows[0]?.identity),
      rut: Boolean(rows[0]?.rut)
    };
  }

  const [emailCount, identityCount, rutCount] = await Promise.all([
    countCollectionDocuments(securityConfig.collections.signatures, [
      { field: "dedupe.emailHash", op: "EQUAL", value: keys.emailHash }
    ]),
    countCollectionDocuments(securityConfig.collections.signatures, [
      { field: "dedupe.identityHash", op: "EQUAL", value: keys.identityHash }
    ]),
    countCollectionDocuments(securityConfig.collections.signatures, [
      { field: "dedupe.rutHash", op: "EQUAL", value: keys.rutHash }
    ])
  ]);

  return {
    email: emailCount > 0,
    identity: identityCount > 0,
    rut: rutCount > 0
  };
}

export async function getPublicSignatureBreakdown() {
  const [storedCounter, firestoreCounter] = await Promise.all([
    readCounterSourceWithTimeout("supabase", getStoredPublicCounter),
    isPublicFirestoreConfigured
      ? readCounterSourceWithTimeout("firestore", getPublicCounterBreakdownFromFirestore)
      : Promise.resolve(null)
  ]);

  const liveCounters = addCounterBreakdowns(
    firestoreCounter,
    hasPublicCounterFields(storedCounter)
      ? {
          count: Number(storedCounter.count ?? 0),
          chileanCount: Number(storedCounter.chileanCount ?? 0),
          foreignCount: Number(storedCounter.foreignCount ?? 0)
        }
      : null
  );

  if (!firestoreCounter && !hasPublicCounterFields(storedCounter)) {
    return emergencySignatureCounterFallback;
  }

  return mergePublicCounterSources(liveCounters);
}

export async function getCachedPublicSignatureBreakdown(
  forceRefresh = false
): Promise<SignatureCounterBreakdown> {
  if (!forceRefresh && signatureCounterCache && signatureCounterCache.expiresAt > Date.now()) {
    void recordCounterReadEvent("cache_hit");
    return signatureCounterCache.value;
  }

  void recordCounterReadEvent("cache_miss");
  const value = await getPublicSignatureBreakdown();
  signatureCounterCache = {
    value,
    expiresAt: Date.now() + signatureCounterCacheTtlMs
  };
  return value;
}

export async function storeSignature(input: StoredSignatureInput) {
  const signatureId = crypto.randomUUID();

  if (isPostgresAvailable) {
    await withPostgres((sql) =>
      sql.begin(async (tx) => {
        await tx`
          insert into signatures (
            id, first_name, last_name, full_name, rut, email, age, country, legal_nature, region,
            commune, affiliation, message, consent, updates, status, abuse_reason, risk_decision,
            risk_reasons, risk_score, dedupe_email_hash, dedupe_identity_hash, dedupe_rut_hash,
            dedupe_ip_email_hash, source_ip_hash, source_user_agent_hash, source_fingerprint_hash,
            source_origin_host, source_submitted_at_ms, security_token_issued_at_ms,
            security_submit_time_ms, security_captcha_verified, security_high_protection_mode,
            created_at_ms, updated_at_ms, source_name
          ) values (
            ${signatureId}, ${input.signature.firstName}, ${input.signature.lastName},
            ${input.signature.fullName}, ${input.signature.rut}, ${input.signature.email},
            ${input.signature.age}, ${input.signature.country}, ${input.signature.legalNature},
            ${input.signature.region}, ${input.signature.commune}, ${input.signature.affiliation},
            ${input.signature.message}, ${input.signature.consent}, ${input.signature.updates},
            ${input.status}, ${input.abuseReason}, ${input.riskDecision},
            ${JSON.stringify(input.riskReasons)}::jsonb, ${input.riskScore},
            ${input.dedupeKeys.emailHash}, ${input.dedupeKeys.identityHash},
            ${input.dedupeKeys.rutHash}, ${input.dedupeKeys.ipEmailHash}, ${input.source.ipHash},
            ${input.source.userAgentHash}, ${input.source.fingerprintHash},
            ${input.source.originHost}, ${input.source.submittedAtMs},
            ${input.metadata.tokenIssuedAtMs}, ${input.metadata.submitTimeMs},
            ${input.metadata.captchaVerified}, ${input.metadata.highProtectionMode},
            ${input.source.submittedAtMs}, ${input.source.submittedAtMs}, 'campaign-site'
          )
        `;

        if (input.status === "accepted") {
          const counterField = getCounterFieldToIncrement(input.signature.country);
          if (counterField === "chileanCount") {
            await tx`
              update signature_counter
              set count = count + 1,
                  chilean_count = chilean_count + 1,
                  updated_at_ms = ${input.source.submittedAtMs}
              where counter_key = 'public'
            `;
          } else {
            await tx`
              update signature_counter
              set count = count + 1,
                  foreign_count = foreign_count + 1,
                  updated_at_ms = ${input.source.submittedAtMs}
              where counter_key = 'public'
            `;
          }
        }
      })
    );
    if (input.status === "accepted") {
      bumpSignatureCounterCache(input.signature.country);
    } else {
      invalidateSignatureCounterCache();
    }
    return;
  }

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
    )
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
    writes.push(
      encodeIncrementTransforms(publicCounterPath, ["count", getCounterFieldToIncrement(input.signature.country)])
    );
  }

  const result = await commitWrites(writes);
  if (input.status === "accepted") {
    bumpSignatureCounterCache(input.signature.country);
  } else {
    invalidateSignatureCounterCache();
  }
  return result;
}

export async function signatureExists(keys: {
  emailHash: string;
  identityHash: string;
  rutHash: string;
}) {
  const match = await getDuplicateMatch(keys);
  return match.any;
}

export async function getDuplicateMatch(keys: {
  emailHash: string;
  identityHash: string;
  rutHash: string;
}) {
  if (isPostgresAvailable) {
    const directMatch = await findDuplicateInSignatures(keys);
    return {
      ...directMatch,
      any: Boolean(directMatch.email || directMatch.identity || directMatch.rut)
    };
  }

  const [emailDoc, identityDoc, rutDoc] = await Promise.all([
    getDocument(`${securityConfig.collections.dedupeEmails}/${keys.emailHash}`),
    getDocument(`${securityConfig.collections.dedupeIdentity}/${keys.identityHash}`),
    getDocument(`${securityConfig.collections.dedupeRut}/${keys.rutHash}`)
  ]);

  const directMatch = {
    email: Boolean(emailDoc),
    identity: Boolean(identityDoc),
    rut: Boolean(rutDoc)
  };

  if (directMatch.email || directMatch.identity || directMatch.rut) {
    return {
      ...directMatch,
      any: true
    };
  }

  const signatureMatch = await findDuplicateInSignatures(keys);
  return {
    ...signatureMatch,
    any: Boolean(signatureMatch.email || signatureMatch.identity || signatureMatch.rut)
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

export interface SignatureExportRow {
  id: string;
  fullName: string;
  country: string;
  region: string;
  commune: string;
  legalNature: string;
  affiliation: string;
  status: string;
  createdAtMs: number;
  source?: { submittedAtMs?: number };
}

export async function listFlaggedSignatures(page = 1, pageSize = 20): Promise<FlaggedSignatureRecord[]> {
  if (isPostgresAvailable) {
    await recordPostgresReadEvent("signature_flagged_list");
    const rows = await withPostgres((sql) => sql`
      select id, full_name, country, region, commune, legal_nature, affiliation, status,
             risk_score, risk_reasons, created_at_ms, source_submitted_at_ms
      from signatures
      where status = 'flagged'
      order by created_at_ms desc
      limit ${pageSize}
      offset ${(page - 1) * pageSize}
    `);
    return rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      country: row.country,
      region: row.region,
      commune: row.commune,
      legalNature: row.legal_nature,
      affiliation: row.affiliation,
      status: row.status,
      riskScore: Number(row.risk_score ?? 0),
      riskReasons: Array.isArray(row.risk_reasons) ? row.risk_reasons : [],
      createdAtMs: Number(row.created_at_ms ?? 0),
      submittedAtMs: Number(row.source_submitted_at_ms ?? 0)
    }));
  }

  const rows = await queryCollection<FlaggedSignatureRecord>({
    collectionId: securityConfig.collections.signatures,
    filters: [{ field: "status", op: "EQUAL", value: "flagged" }],
    orderBy: [{ field: "createdAtMs", direction: "DESCENDING" }],
    limit: pageSize,
    offset: (page - 1) * pageSize
  });
  return rows;
}

export async function listSignaturesForExport(
  status: "accepted" | "flagged" | "rejected" | "all",
  limit = 5000
): Promise<SignatureExportRow[]> {
  if (isPostgresAvailable) {
    await recordPostgresReadEvent("signature_export");
    const rows =
      status === "all"
        ? await withPostgres((sql) => sql`
            select id, full_name, country, region, commune, legal_nature, affiliation, status,
                   created_at_ms, source_submitted_at_ms
            from signatures
            order by created_at_ms desc
            limit ${limit}
          `)
        : await withPostgres((sql) => sql`
            select id, full_name, country, region, commune, legal_nature, affiliation, status,
                   created_at_ms, source_submitted_at_ms
            from signatures
            where status = ${status}
            order by created_at_ms desc
            limit ${limit}
          `);

    return rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      country: row.country,
      region: row.region,
      commune: row.commune,
      legalNature: row.legal_nature,
      affiliation: row.affiliation,
      status: row.status,
      createdAtMs: Number(row.created_at_ms ?? 0),
      source: {
        submittedAtMs: Number(row.source_submitted_at_ms ?? 0)
      }
    }));
  }

  const filters = status === "all" ? [] : [{ field: "status", op: "EQUAL", value: status }];
  return queryCollection<SignatureExportRow>({
    collectionId: securityConfig.collections.signatures,
    filters,
    orderBy: [{ field: "createdAtMs", direction: "DESCENDING" }],
    limit
  });
}

export async function reviewFlaggedSignature(params: {
  signatureId: string;
  decision: "accepted" | "rejected";
}): Promise<void> {
  if (isPostgresAvailable) {
    await recordPostgresReadEvent("signature_review_lookup");
    await withPostgres((sql) =>
      sql.begin(async (tx) => {
        const rows = await tx`
          select *
          from signatures
          where id = ${params.signatureId}
          limit 1
        `;
        const current = rows[0];
        if (!current) throw new Error("signature-not-found");

        const now = Date.now();
        await tx`
          update signatures
          set status = ${params.decision},
              updated_at_ms = ${now}
          where id = ${params.signatureId}
        `;

        if (current.status !== "accepted" && params.decision === "accepted") {
          const counterField = getCounterFieldToIncrement(String(current.country ?? ""));
          if (counterField === "chileanCount") {
            await tx`
              update signature_counter
              set count = count + 1,
                  chilean_count = chilean_count + 1,
                  updated_at_ms = ${now}
              where counter_key = 'public'
            `;
          } else {
            await tx`
              update signature_counter
              set count = count + 1,
                  foreign_count = foreign_count + 1,
                  updated_at_ms = ${now}
              where counter_key = 'public'
            `;
          }
        }
      })
    );
    if (params.decision === "accepted") {
      const current = await getPublicSignatureBreakdown();
      setSignatureCounterCache(current);
    } else {
      invalidateSignatureCounterCache();
    }
    return;
  }

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
    writes.push(
      encodeIncrementTransforms(publicCounterPath, ["count", getCounterFieldToIncrement(String(doc.country ?? ""))])
    );
  }

  await commitWrites(writes);
  if (params.decision === "accepted") {
    const current = await getPublicSignatureBreakdown();
    setSignatureCounterCache(current);
  } else {
    invalidateSignatureCounterCache();
  }
}
