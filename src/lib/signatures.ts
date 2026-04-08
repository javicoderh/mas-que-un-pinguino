export interface SignatureCounterPayload {
  count: number;
  chileanCount: number;
  foreignCount: number;
}

export async function getSignatureCount(): Promise<SignatureCounterPayload> {
  const response = await fetch("/api/signatures/count", {
    cache: "no-store",
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("signature-count-unavailable");
  }

  const payload = await response.json();
  return {
    count: Number(payload.count ?? 0),
    chileanCount: Number(payload.chileanCount ?? payload.count ?? 0),
    foreignCount: Number(payload.foreignCount ?? 0)
  };
}
