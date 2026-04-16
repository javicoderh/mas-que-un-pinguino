import { recordPostgresReadEvent, withPostgres, isPostgresAvailable } from "../db/postgres";
import { securityConfig } from "./config";
import { commitWrites, createDocument, encodeDelete, encodeWrite, getDocument, queryCollection } from "./firestore-rest";
import type { NormalizedEventSubmission } from "../validation/event-schema";

export type EventSubmissionStatus = "pending" | "approved" | "rejected" | "flagged";

export interface StoredEventSubmissionInput {
  event: NormalizedEventSubmission;
  status: EventSubmissionStatus;
  riskDecision: "allow" | "flag" | "block";
  riskReasons: string[];
  riskScore: number;
  duplicateHash: string;
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

export interface EventSubmissionRecord {
  id: string;
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
  status: EventSubmissionStatus;
  riskDecision: "allow" | "flag" | "block";
  riskReasons: string[];
  riskScore: number;
  reviewedAtMs?: number;
  reviewedBy?: string;
  reviewDecision?: "approved" | "rejected";
  createdAtMs: number;
  updatedAtMs: number;
}

export interface AdminUserRecord {
  id: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  active: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

function mapEventRow(row: Record<string, any>): EventSubmissionRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    link: row.link ?? "",
    date: row.date,
    time: row.time,
    region: row.region,
    regionKey: row.region_key,
    venue: row.venue,
    organizerName: row.organizer_name,
    organizerEmail: row.organizer_email,
    consent: Boolean(row.consent),
    status: row.status,
    riskDecision: row.risk_decision,
    riskReasons: Array.isArray(row.risk_reasons) ? row.risk_reasons : [],
    riskScore: Number(row.risk_score ?? 0),
    reviewedAtMs: row.reviewed_at_ms ? Number(row.reviewed_at_ms) : undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewDecision: row.review_decision ?? undefined,
    createdAtMs: Number(row.created_at_ms ?? 0),
    updatedAtMs: Number(row.updated_at_ms ?? 0)
  };
}

function mapAdminUserRow(row: Record<string, any>): AdminUserRecord {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    passwordIterations: Number(row.password_iterations ?? 0),
    active: Boolean(row.active),
    createdAtMs: Number(row.created_at_ms ?? 0),
    updatedAtMs: Number(row.updated_at_ms ?? 0)
  };
}

export async function storeEventSubmission(input: StoredEventSubmissionInput) {
  if (isPostgresAvailable) {
    const eventId = crypto.randomUUID();
    const now = input.source.submittedAtMs;
    await withPostgres((sql) => sql`
      insert into event_submissions (
        id, title, description, image_url, link, date, time, region, region_key, venue, organizer_name,
        organizer_email, consent, status, risk_decision, risk_reasons, risk_score, dedupe_hash,
        source_ip_hash, source_user_agent_hash, source_fingerprint_hash, source_origin_host,
        source_submitted_at_ms, security_token_issued_at_ms, security_submit_time_ms,
        security_captcha_verified, security_high_protection_mode, created_at_ms, updated_at_ms
      ) values (
        ${eventId}, ${input.event.title}, ${input.event.description}, ${input.event.imageUrl},
        ${input.event.link}, ${input.event.date}, ${input.event.time}, ${input.event.region}, ${input.event.regionKey},
        ${input.event.venue}, ${input.event.organizerName}, ${input.event.organizerEmail},
        ${input.event.consent}, ${input.status}, ${input.riskDecision},
        ${JSON.stringify(input.riskReasons)}::jsonb, ${input.riskScore}, ${input.duplicateHash},
        ${input.source.ipHash}, ${input.source.userAgentHash}, ${input.source.fingerprintHash},
        ${input.source.originHost}, ${input.source.submittedAtMs}, ${input.metadata.tokenIssuedAtMs},
        ${input.metadata.submitTimeMs}, ${input.metadata.captchaVerified},
        ${input.metadata.highProtectionMode}, ${now}, ${now}
      )
    `);
    return;
  }

  const eventId = crypto.randomUUID();
  const eventPath = `${securityConfig.collections.eventSubmissions}/${eventId}`;
  const now = input.source.submittedAtMs;
  const writes = [
    encodeWrite(
      eventPath,
      {
        title: input.event.title,
        description: input.event.description,
        imageUrl: input.event.imageUrl,
        link: input.event.link,
        date: input.event.date,
        time: input.event.time,
        region: input.event.region,
        regionKey: input.event.regionKey,
        venue: input.event.venue,
        organizerName: input.event.organizerName,
        organizerEmail: input.event.organizerEmail,
        consent: input.event.consent,
        status: input.status,
        riskDecision: input.riskDecision,
        riskReasons: input.riskReasons,
        riskScore: input.riskScore,
        dedupeHash: input.duplicateHash,
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
        createdAtMs: now,
        updatedAtMs: now
      },
      false
    ),
    encodeWrite(
      `${securityConfig.collections.eventDedupe}/${input.duplicateHash}`,
      {
        eventId,
        createdAtMs: now
      },
      false
    )
  ];

  return commitWrites(writes);
}

export async function eventSubmissionExists(duplicateHash: string) {
  if (isPostgresAvailable) {
    await recordPostgresReadEvent("event_dedupe");
    const rows = await withPostgres((sql) => sql`
      select exists(select 1 from event_submissions where dedupe_hash = ${duplicateHash}) as exists
    `);
    return Boolean(rows[0]?.exists);
  }

  const doc = await getDocument(`${securityConfig.collections.eventDedupe}/${duplicateHash}`);
  return Boolean(doc);
}

export async function listEventSubmissions(status?: EventSubmissionStatus, page = 1, pageSize = 20) {
  if (isPostgresAvailable) {
    await recordPostgresReadEvent(status ? "event_submission_list_filtered" : "event_submission_list");
    const rows =
      status
        ? await withPostgres((sql) => sql`
            select *
            from event_submissions
            where status = ${status}
            order by created_at_ms desc
            limit ${pageSize}
            offset ${(page - 1) * pageSize}
          `)
        : await withPostgres((sql) => sql`
            select *
            from event_submissions
            order by created_at_ms desc
            limit ${pageSize}
            offset ${(page - 1) * pageSize}
          `);
    return rows.map(mapEventRow);
  }

  return queryCollection<EventSubmissionRecord>({
    collectionId: securityConfig.collections.eventSubmissions,
    filters: status ? [{ field: "status", op: "EQUAL", value: status }] : [],
    orderBy: [{ field: "createdAtMs", direction: "DESCENDING" }],
    limit: pageSize,
    offset: (page - 1) * pageSize
  });
}

export async function listApprovedEvents() {
  if (isPostgresAvailable) {
    await recordPostgresReadEvent("event_public_list");
    const rows = await withPostgres((sql) => sql`
      select *
      from event_submissions
      where status = 'approved'
      order by created_at_ms desc
      limit 120
    `);
    return rows.map(mapEventRow);
  }

  return queryCollection<EventSubmissionRecord>({
    collectionId: securityConfig.collections.eventSubmissions,
    filters: [{ field: "status", op: "EQUAL", value: "approved" }],
    orderBy: [{ field: "createdAtMs", direction: "DESCENDING" }],
    limit: 120
  });
}

export async function getEventSubmission(id: string) {
  if (isPostgresAvailable) {
    await recordPostgresReadEvent("event_submission_item");
    const rows = await withPostgres((sql) => sql`
      select *
      from event_submissions
      where id = ${id}
      limit 1
    `);
    return rows[0] ? mapEventRow(rows[0]) : null;
  }

  const record = await getDocument<EventSubmissionRecord>(
    `${securityConfig.collections.eventSubmissions}/${id}`
  );
  if (!record) return null;
  const { id: storedId, ...rest } = record as EventSubmissionRecord & { id?: string };
  return { id: storedId ?? id, ...rest };
}

export async function reviewEventSubmission(params: {
  eventId: string;
  decision: "approved" | "rejected";
  reviewer: string;
}) {
  if (isPostgresAvailable) {
    await recordPostgresReadEvent("event_review_returning");
    const reviewedAtMs = Date.now();
    const rows = await withPostgres((sql) => sql`
      update event_submissions
      set status = ${params.decision},
          review_decision = ${params.decision},
          reviewed_by = ${params.reviewer},
          reviewed_at_ms = ${reviewedAtMs},
          updated_at_ms = ${reviewedAtMs}
      where id = ${params.eventId}
      returning *
    `);
    if (!rows[0]) throw new Error("event-not-found");
    return;
  }

  const current = await getEventSubmission(params.eventId);
  if (!current) {
    throw new Error("event-not-found");
  }

  const reviewedAtMs = Date.now();
  const { id: _id, ...documentData } = current;
  return commitWrites([
    encodeWrite(
      `${securityConfig.collections.eventSubmissions}/${params.eventId}`,
      {
        ...documentData,
        status: params.decision,
        reviewDecision: params.decision,
        reviewedBy: params.reviewer,
        reviewedAtMs,
        updatedAtMs: reviewedAtMs
      },
      true
    )
  ]);
}

export async function deleteEventSubmission(params: {
  eventId: string;
}) {
  if (isPostgresAvailable) {
    await recordPostgresReadEvent("event_delete_returning");
    const rows = await withPostgres((sql) => sql`
      delete from event_submissions
      where id = ${params.eventId}
      returning id
    `);
    if (!rows[0]) throw new Error("event-not-found");
    return;
  }

  const current = await getEventSubmission(params.eventId);
  if (!current) {
    throw new Error("event-not-found");
  }

  return commitWrites([
    encodeDelete(`${securityConfig.collections.eventSubmissions}/${params.eventId}`, true)
  ]);
}

export async function getAdminUserByUsername(username: string) {
  if (isPostgresAvailable) {
    await recordPostgresReadEvent("admin_user_lookup");
    const rows = await withPostgres((sql) => sql`
      select *
      from admin_users
      where username = ${username}
      limit 1
    `);
    return rows[0] ? mapAdminUserRow(rows[0]) : null;
  }

  const matches = await queryCollection<AdminUserRecord>({
    collectionId: securityConfig.collections.adminUsers,
    filters: [{ field: "username", op: "EQUAL", value: username }],
    limit: 1
  });
  return matches[0] ?? null;
}

export async function ensureAdminUser(params: {
  username: string;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
}) {
  const existing = await getAdminUserByUsername(params.username);
  if (existing) return existing;

  const id = crypto.randomUUID();
  const now = Date.now();

  if (isPostgresAvailable) {
    await withPostgres((sql) => sql`
      insert into admin_users (
        id, username, password_hash, password_salt, password_iterations, active, created_at_ms, updated_at_ms
      ) values (
        ${id}, ${params.username}, ${params.passwordHash}, ${params.passwordSalt},
        ${params.passwordIterations}, true, ${now}, ${now}
      )
    `);
    return {
      id,
      username: params.username,
      passwordHash: params.passwordHash,
      passwordSalt: params.passwordSalt,
      passwordIterations: params.passwordIterations,
      active: true,
      createdAtMs: now,
      updatedAtMs: now
    } satisfies AdminUserRecord;
  }

  await createDocument(`${securityConfig.collections.adminUsers}/${id}`, {
    username: params.username,
    passwordHash: params.passwordHash,
    passwordSalt: params.passwordSalt,
    passwordIterations: params.passwordIterations,
    active: true,
    createdAtMs: now,
    updatedAtMs: now
  });

  return {
    id,
    username: params.username,
    passwordHash: params.passwordHash,
    passwordSalt: params.passwordSalt,
    passwordIterations: params.passwordIterations,
    active: true,
    createdAtMs: now,
    updatedAtMs: now
  } satisfies AdminUserRecord;
}

export async function updateAdminUserPassword(params: {
  username: string;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
}) {
  const user = await getAdminUserByUsername(params.username);
  if (!user) throw new Error("admin-user-not-found");

  const now = Date.now();

  if (isPostgresAvailable) {
    await withPostgres((sql) => sql`
      update admin_users
      set password_hash = ${params.passwordHash},
          password_salt = ${params.passwordSalt},
          password_iterations = ${params.passwordIterations},
          updated_at_ms = ${now}
      where id = ${user.id}
    `);
    return;
  }

  const { id, ...documentData } = user;
  return commitWrites([
    encodeWrite(
      `${securityConfig.collections.adminUsers}/${id}`,
      {
        ...documentData,
        passwordHash: params.passwordHash,
        passwordSalt: params.passwordSalt,
        passwordIterations: params.passwordIterations,
        updatedAtMs: now
      },
      true
    )
  ]);
}
