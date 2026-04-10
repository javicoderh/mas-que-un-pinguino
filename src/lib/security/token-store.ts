import { withPostgres, isPostgresAvailable } from "../db/postgres";
import { securityConfig } from "./config";
import { createDocument, getDocument } from "./firestore-rest";
import { sha256Hex } from "./hash";

export async function isTokenUsed(nonce: string): Promise<boolean> {
  const hash = await sha256Hex(nonce);

  if (isPostgresAvailable) {
    const rows = await withPostgres((sql) => sql`
      select expires_at_ms
      from used_tokens
      where nonce_hash = ${hash}
      limit 1
    `);
    const record = rows[0];
    if (!record) return false;
    return Number(record.expires_at_ms ?? 0) >= Date.now();
  }

  const doc = await getDocument(`${securityConfig.collections.usedTokens}/${hash}`);
  if (!doc) return false;
  const record = doc as { expiresAtMs?: number };
  if (record.expiresAtMs && record.expiresAtMs < Date.now()) return false;
  return true;
}

export async function markTokenUsed(nonce: string, ttlMs: number): Promise<void> {
  const hash = await sha256Hex(nonce);
  const expiresAtMs = Date.now() + ttlMs;

  if (isPostgresAvailable) {
    await withPostgres((sql) => sql`
      insert into used_tokens (nonce_hash, expires_at_ms, created_at_ms)
      values (${hash}, ${expiresAtMs}, ${Date.now()})
      on conflict (nonce_hash) do nothing
    `);
    return;
  }

  try {
    await createDocument(`${securityConfig.collections.usedTokens}/${hash}`, {
      expiresAtMs,
      createdAtMs: Date.now()
    });
  } catch {
    // If doc already exists (race condition), token is already marked as used
  }
}
