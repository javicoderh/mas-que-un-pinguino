export interface SignatureCounterPayload {
  count: number;
  chileanCount: number;
  foreignCount: number;
}

// Client-side cache: share one in-flight request across all counter consumers on the same page.
// TTL matches the central counter refresh cadence (10 min).
let _cachedCountEntry: { promise: Promise<SignatureCounterPayload>; expiresAt: number } | null = null;

export function getSignatureCount(): Promise<SignatureCounterPayload> {
  if (_cachedCountEntry && _cachedCountEntry.expiresAt > Date.now()) {
    return _cachedCountEntry.promise;
  }

  const promise = fetch("/api/signatures/count", {
    headers: { accept: "application/json" }
  }).then(async (response) => {
    if (!response.ok) throw new Error("signature-count-unavailable");
    const payload = await response.json();
    return {
      count: Number(payload.count ?? 0),
      chileanCount: Number(payload.chileanCount ?? payload.count ?? 0),
      foreignCount: Number(payload.foreignCount ?? 0)
    };
  });

  // On error, clear the cache so the next call retries
  promise.catch(() => { _cachedCountEntry = null; });

  _cachedCountEntry = { promise, expiresAt: Date.now() + 10 * 60_000 };
  return promise;
}

export function invalidateSignatureCountCache(): void {
  _cachedCountEntry = null;
}

export function setSignatureCountCache(payload: SignatureCounterPayload): void {
  _cachedCountEntry = {
    promise: Promise.resolve(payload),
    expiresAt: Date.now() + 10 * 60_000
  };
}
