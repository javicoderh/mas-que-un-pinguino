import { withPostgres, isPostgresAvailable } from "../db/postgres";
import { securityConfig, type RateLimitRule } from "./config";
import { createDocument, countNestedDocuments } from "./firestore-rest";
import { logSecurityEvent } from "./logging";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  counts: Record<string, number>;
  exceededRule?: string;
}

const safeKey = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "");

const fallbackStore = new Map<string, number[]>();
const FALLBACK_WINDOW_MS = 60_000;
const FALLBACK_MAX_HITS = 1;

function enforceFallbackRateLimit(
  scope: string,
  keyHash: string,
  rules: RateLimitRule[]
): RateLimitResult {
  const storeKey = `${scope}:${keyHash}`;
  const now = Date.now();
  const timestamps = (fallbackStore.get(storeKey) ?? []).filter(
    (ts) => ts > now - FALLBACK_WINDOW_MS
  );
  timestamps.push(now);
  fallbackStore.set(storeKey, timestamps);

  const count = timestamps.length;
  const counts: Record<string, number> = {};
  for (const rule of rules) {
    counts[rule.name] = count;
  }

  if (count > FALLBACK_MAX_HITS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(FALLBACK_WINDOW_MS / 1000),
      counts,
      exceededRule: "fallback_strict"
    };
  }

  return { allowed: true, retryAfterSeconds: 0, counts };
}

export async function enforceRateLimit(
  scope: string,
  keyHash: string,
  rules: RateLimitRule[],
  metadata: { route: string; action: string }
): Promise<RateLimitResult> {
  const now = Date.now();

  if (isPostgresAvailable) {
    try {
      await withPostgres((sql) =>
        sql.begin(async (tx) => {
          await tx`
            insert into rate_limit_events (
              id, scope, key_hash, route, action, submitted_at_ms, expires_at_ms
            ) values (
              ${crypto.randomUUID()}, ${safeKey(scope)}, ${safeKey(keyHash)}, ${metadata.route},
              ${metadata.action}, ${now}, ${now + Math.max(...rules.map((rule) => rule.windowMs))}
            )
          `;

          await tx`
            delete from rate_limit_events
            where expires_at_ms < ${now}
          `;
        })
      );

      const counts: Record<string, number> = {};
      let retryAfterSeconds = 0;
      let exceededRule: string | undefined;

      for (const rule of rules) {
        const rows = await withPostgres((sql) => sql`
          select count(*)::int as total
          from rate_limit_events
          where scope = ${safeKey(scope)}
            and key_hash = ${safeKey(keyHash)}
            and submitted_at_ms >= ${now - rule.windowMs}
        `);
        const count = Number(rows[0]?.total ?? 0);
        counts[rule.name] = count;

        if (count > rule.maxHits && !exceededRule) {
          exceededRule = rule.name;
          retryAfterSeconds = Math.ceil(rule.windowMs / 1000);
        }
      }

      return {
        allowed: !exceededRule,
        retryAfterSeconds,
        counts,
        exceededRule
      };
    } catch (error) {
      logSecurityEvent({
        route: metadata.route,
        action: metadata.action,
        decision: "flag",
        reasonCodes: ["rate_limit_postgres_fallback"],
        metadata: {
          error: error instanceof Error ? error.message : String(error)
        }
      });

      return enforceFallbackRateLimit(scope, keyHash, rules);
    }
  }

  const rootDoc = `${securityConfig.collections.rateLimitRoot}/${safeKey(scope)}_${safeKey(keyHash)}`;
  const eventId = crypto.randomUUID();

  try {
    await createDocument(`${rootDoc}/events/${eventId}`, {
      route: metadata.route,
      action: metadata.action,
      submittedAtMs: now,
      expiresAtMs: now + Math.max(...rules.map((rule) => rule.windowMs))
    });

    const counts: Record<string, number> = {};
    let retryAfterSeconds = 0;
    let exceededRule: string | undefined;

    for (const rule of rules) {
      const count = await countNestedDocuments(rootDoc, "events", now - rule.windowMs);
      counts[rule.name] = count;

      if (count > rule.maxHits && !exceededRule) {
        exceededRule = rule.name;
        retryAfterSeconds = Math.ceil(rule.windowMs / 1000);
      }
    }

    return {
      allowed: !exceededRule,
      retryAfterSeconds,
      counts,
      exceededRule
    };
  } catch (error) {
    logSecurityEvent({
      route: metadata.route,
      action: metadata.action,
      decision: "flag",
      reasonCodes: ["rate_limit_firestore_fallback"],
      metadata: {
        error: error instanceof Error ? error.message : String(error)
      }
    });

    return enforceFallbackRateLimit(scope, keyHash, rules);
  }
}
