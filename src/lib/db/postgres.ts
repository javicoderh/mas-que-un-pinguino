import postgres, { type Sql } from "postgres";
import { securityConfig } from "../security/config";

export const isPostgresAvailable = Boolean(securityConfig.postgres.url);

let pooledClient: Sql | null = null;
let unpooledClient: Sql | null = null;
let schemaReadyPromise: Promise<boolean> | null = null;

const parseBoolean = (value: unknown, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

const schemaBootstrapTimeoutMs = Number(import.meta.env.POSTGRES_SCHEMA_BOOTSTRAP_TIMEOUT_MS ?? "1500");
const requireRuntimeSchemaBootstrap = parseBoolean(import.meta.env.POSTGRES_REQUIRE_SCHEMA_BOOTSTRAP, import.meta.env.DEV);
// When the schema already exists (e.g. managed externally / Supabase), skip the
// runtime bootstrap entirely — the ~30-statement DDL transaction otherwise blocks
// the first requests for several seconds on a remote DB.
const skipSchemaBootstrap = parseBoolean(import.meta.env.POSTGRES_SKIP_SCHEMA_BOOTSTRAP, false);
const poolMax = Number(import.meta.env.POSTGRES_POOL_MAX ?? "1");

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label}-timeout`)), timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function createClient(connectionString: string) {
  return postgres(connectionString, {
    prepare: false,
    connect_timeout: 15,
    idle_timeout: 20,
    max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 1,
    ssl: "require"
  });
}

export function getPostgres(): Sql {
  if (!isPostgresAvailable) {
    throw new Error("postgres-not-configured");
  }

  if (!pooledClient) {
    pooledClient = createClient(securityConfig.postgres.url);
  }

  return pooledClient;
}

function getPostgresAdmin(): Sql {
  if (!isPostgresAvailable) {
    throw new Error("postgres-not-configured");
  }

  if (!unpooledClient) {
    unpooledClient = createClient(securityConfig.postgres.unpooledUrl);
  }

  return unpooledClient;
}

async function createSchema(sql: Sql) {
  await sql.begin(async (tx) => {
    await tx`
      create table if not exists signatures (
        id uuid primary key,
        first_name text not null,
        last_name text not null,
        full_name text not null,
        rut text not null,
        email text not null,
        age text not null,
        country text not null,
        legal_nature text not null,
        region text not null,
        commune text not null,
        affiliation text not null,
        message text not null,
        consent boolean not null,
        updates boolean not null,
        status text not null,
        abuse_reason text,
        risk_decision text not null,
        risk_reasons jsonb not null default '[]'::jsonb,
        risk_score integer not null,
        dedupe_email_hash text not null,
        dedupe_identity_hash text not null,
        dedupe_rut_hash text not null,
        dedupe_ip_email_hash text not null,
        source_ip_hash text not null,
        source_user_agent_hash text not null,
        source_fingerprint_hash text not null,
        source_origin_host text,
        source_submitted_at_ms bigint not null,
        security_token_issued_at_ms bigint not null,
        security_submit_time_ms bigint not null,
        security_captcha_verified boolean not null,
        security_high_protection_mode boolean not null,
        created_at_ms bigint not null,
        updated_at_ms bigint not null,
        source_name text not null
      )
    `;
    await tx`create unique index if not exists signatures_dedupe_email_hash_key on signatures (dedupe_email_hash)`;
    await tx`create unique index if not exists signatures_dedupe_identity_hash_key on signatures (dedupe_identity_hash)`;
    await tx`create unique index if not exists signatures_dedupe_rut_hash_key on signatures (dedupe_rut_hash)`;
    await tx`create index if not exists signatures_status_created_idx on signatures (status, created_at_ms desc)`;
    await tx`create index if not exists signatures_created_idx on signatures (created_at_ms desc)`;

    await tx`
      create table if not exists signature_counter (
        counter_key text primary key,
        count integer not null default 0,
        chilean_count integer not null default 0,
        foreign_count integer not null default 0,
        updated_at_ms bigint not null
      )
    `;
    await tx`
      insert into signature_counter (counter_key, count, chilean_count, foreign_count, updated_at_ms)
      values ('public', 0, 0, 0, ${Date.now()})
      on conflict (counter_key) do nothing
    `;

    await tx`
      create table if not exists counter_read_events (
        id uuid primary key,
        source text not null,
        read_kind text not null,
        read_at_ms bigint not null
      )
    `;
    await tx`create index if not exists counter_read_events_kind_time_idx on counter_read_events (read_kind, read_at_ms desc)`;

    await tx`
      create table if not exists used_tokens (
        nonce_hash text primary key,
        expires_at_ms bigint not null,
        created_at_ms bigint not null
      )
    `;

    await tx`
      create table if not exists rate_limit_events (
        id uuid primary key,
        scope text not null,
        key_hash text not null,
        route text not null,
        action text not null,
        submitted_at_ms bigint not null,
        expires_at_ms bigint not null
      )
    `;
    await tx`create index if not exists rate_limit_lookup_idx on rate_limit_events (scope, key_hash, submitted_at_ms desc)`;

    await tx`
      create table if not exists event_submissions (
        id uuid primary key,
        title text not null,
        description text not null,
        image_url text not null,
        date text not null,
        time text not null,
        region text not null,
        region_key text not null,
        venue text not null,
        organizer_name text not null,
        organizer_email text not null,
        consent boolean not null,
        status text not null,
        risk_decision text not null,
        risk_reasons jsonb not null default '[]'::jsonb,
        risk_score integer not null,
        dedupe_hash text not null unique,
        source_ip_hash text not null,
        source_user_agent_hash text not null,
        source_fingerprint_hash text not null,
        source_origin_host text,
        source_submitted_at_ms bigint not null,
        security_token_issued_at_ms bigint not null,
        security_submit_time_ms bigint not null,
        security_captcha_verified boolean not null,
        security_high_protection_mode boolean not null,
        reviewed_at_ms bigint,
        reviewed_by text,
        review_decision text,
        created_at_ms bigint not null,
        updated_at_ms bigint not null
      )
    `;
    await tx`create index if not exists event_submissions_status_created_idx on event_submissions (status, created_at_ms desc)`;

    await tx`
      create table if not exists admin_users (
        id uuid primary key,
        username text not null unique,
        password_hash text not null,
        password_salt text not null,
        password_iterations integer not null,
        active boolean not null,
        created_at_ms bigint not null,
        updated_at_ms bigint not null
      )
    `;

    await tx`
      create table if not exists news_items (
        id uuid primary key,
        title text not null,
        body text not null,
        preference integer not null default 0,
        created_at_ms bigint not null,
        updated_at_ms bigint not null
      )
    `;
    await tx`create index if not exists news_items_created_idx on news_items (created_at_ms desc)`;
    await tx`alter table news_items add column if not exists link text not null default ''`;
    await tx`alter table news_items add column if not exists image_url text not null default ''`;
    await tx`alter table event_submissions add column if not exists link text not null default ''`;

    await tx`
      create table if not exists foreign_signatures (
        id uuid primary key,
        name text not null,
        country text not null,
        reason text not null,
        email text not null,
        email_hash text not null unique,
        status text not null default 'accepted',
        source_ip_hash text not null,
        created_at_ms bigint not null,
        updated_at_ms bigint not null
      )
    `;
    await tx`create index if not exists foreign_signatures_created_idx on foreign_signatures (created_at_ms desc)`;

    await tx`
      create table if not exists donations (
        id uuid primary key,
        flow_order text,
        flow_token text unique,
        donor_name text not null,
        email text not null,
        amount integer not null,
        currency text not null default 'CLP',
        language text not null default 'es',
        status text not null default 'pending',
        receipt_number text,
        paid_at_ms bigint,
        created_at_ms bigint not null,
        updated_at_ms bigint not null
      )
    `;
    await tx`create index if not exists donations_status_created_idx on donations (status, created_at_ms desc)`;
    await tx`alter table donations add column if not exists currency text not null default 'CLP'`;
    await tx`alter table donations add column if not exists language text not null default 'es'`;
  });
}

export async function ensurePostgresSchema() {
  if (!isPostgresAvailable) return;
  if (skipSchemaBootstrap) return;
  if (!schemaReadyPromise) {
    schemaReadyPromise = createSchema(getPostgresAdmin()).then(
      () => true,
      (error) => {
        schemaReadyPromise = null;
        console.error("postgres-schema-bootstrap-failed", error);
        return false;
      }
    );
  }

  const ready = await withTimeout(
    schemaReadyPromise,
    Number.isFinite(schemaBootstrapTimeoutMs) && schemaBootstrapTimeoutMs > 0 ? schemaBootstrapTimeoutMs : 1500,
    "postgres-schema-bootstrap"
  ).catch((error) => {
    console.error("postgres-schema-bootstrap-timeout", error);
    return false;
  });

  if (!ready && requireRuntimeSchemaBootstrap) {
    throw new Error("postgres-schema-bootstrap-unavailable");
  }
}

async function tryRecordPostgresReadEvent(
  source: string,
  readKind: "db_read" | "cache_hit" | "cache_miss"
) {
  try {
    await getPostgres()`
      insert into counter_read_events (id, source, read_kind, read_at_ms)
      values (${crypto.randomUUID()}, ${source}, ${readKind}, ${Date.now()})
    `;
  } catch (error) {
    console.error("counter-read-event-write-failed", error);
  }
}

export async function recordPostgresReadEvent(
  source: string,
  readKind: "db_read" | "cache_hit" | "cache_miss" = "db_read"
) {
  if (!isPostgresAvailable) return;

  await withTimeout(
    tryRecordPostgresReadEvent(source, readKind),
    1000,
    "counter-read-event-write"
  ).catch((error) => {
    console.error("counter-read-event-write-timeout", error);
  });
}

export async function withPostgres<T>(callback: (sql: Sql) => Promise<T>): Promise<T> {
  await ensurePostgresSchema();
  return callback(getPostgres());
}

export function isUniqueViolation(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
  );
}
