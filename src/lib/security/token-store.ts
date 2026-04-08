import { securityConfig } from "./config";
import { createDocument, getDocument } from "./firestore-rest";
import { sha256Hex } from "./hash";

export async function isTokenUsed(nonce: string): Promise<boolean> {
  const hash = await sha256Hex(nonce);
  const doc = await getDocument(`${securityConfig.collections.usedTokens}/${hash}`);
  if (!doc) return false;
  const record = doc as { expiresAtMs?: number };
  if (record.expiresAtMs && record.expiresAtMs < Date.now()) return false;
  return true;
}

export async function markTokenUsed(nonce: string, ttlMs: number): Promise<void> {
  const hash = await sha256Hex(nonce);
  const expiresAtMs = Date.now() + ttlMs;
  try {
    await createDocument(`${securityConfig.collections.usedTokens}/${hash}`, {
      expiresAtMs,
      createdAtMs: Date.now()
    });
  } catch {
    // If doc already exists (race condition), token is already marked as used
  }
}
