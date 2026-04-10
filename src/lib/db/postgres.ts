import postgres, { type Sql } from "postgres";
import { securityConfig } from "../security/config";

export const isPostgresAvailable = Boolean(securityConfig.postgres.url);

let pooledClient: Sql | null = null;
let unpooledClient: Sql | null = null;
let schemaReadyPromise: Promise<void> | null = null;

function createClient(connectionString: string) {
  return postgres(connectionString, {
    prepare: false,
    connect_timeout: 15,
    idle_timeout: 20,
    max: 1,
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
  });
}

export async function ensurePostgresSchema() {
  if (!isPostgresAvailable) return;
  if (!schemaReadyPromise) {
    schemaReadyPromise = createSchema(getPostgresAdmin()).catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }
  await schemaReadyPromise;
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
