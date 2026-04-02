import { securityConfig, type RateLimitRule } from "./config";
import { createDocument, countNestedDocuments } from "./firestore-rest";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  counts: Record<string, number>;
  exceededRule?: string;
}

const safeKey = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "");

export async function enforceRateLimit(
  scope: string,
  keyHash: string,
  rules: RateLimitRule[],
  metadata: { route: string; action: string }
): Promise<RateLimitResult> {
  const now = Date.now();
  const rootDoc = `${securityConfig.collections.rateLimitRoot}/${safeKey(scope)}_${safeKey(keyHash)}`;
  const eventId = crypto.randomUUID();

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
}
