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

export async function storeEventSubmission(input: StoredEventSubmissionInput) {
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
  const doc = await getDocument(`${securityConfig.collections.eventDedupe}/${duplicateHash}`);
  return Boolean(doc);
}

export async function listEventSubmissions(status?: EventSubmissionStatus, page = 1, pageSize = 20) {
  const rows = await queryCollection<EventSubmissionRecord>({
    collectionId: securityConfig.collections.eventSubmissions,
    filters: status ? [{ field: "status", op: "EQUAL", value: status }] : [],
    orderBy: [{ field: "createdAtMs", direction: "DESCENDING" }],
    limit: pageSize,
    offset: (page - 1) * pageSize
  });
  return rows;
}

export async function listApprovedEvents() {
  const rows = await queryCollection<EventSubmissionRecord>({
    collectionId: securityConfig.collections.eventSubmissions,
    filters: [{ field: "status", op: "EQUAL", value: "approved" }],
    orderBy: [{ field: "createdAtMs", direction: "DESCENDING" }],
    limit: 120
  });
  return rows;
}

export async function getEventSubmission(id: string) {
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
  const current = await getEventSubmission(params.eventId);

  if (!current) {
    throw new Error("event-not-found");
  }

  return commitWrites([
    encodeDelete(`${securityConfig.collections.eventSubmissions}/${params.eventId}`, true)
  ]);
}

export async function getAdminUserByUsername(username: string) {
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
