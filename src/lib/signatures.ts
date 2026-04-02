export async function getSignatureCount() {
  const response = await fetch("/api/signatures/count", {
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("signature-count-unavailable");
  }

  const payload = await response.json();
  return Number(payload.count ?? 0);
}
