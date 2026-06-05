import { alertWebhookUrl } from "./config";

export interface AlertWindowCounts {
  accepted: number;
  flagged: number;
  blocked: number;
}

export async function checkAndFireAlert(
  counts: AlertWindowCounts,
  requestId?: string
): Promise<void> {
  if (!alertWebhookUrl) return;

  const total = counts.accepted + counts.flagged + counts.blocked;
  if (total === 0) return;

  const suspiciousRatio = (counts.flagged + counts.blocked) / total;
  if (suspiciousRatio <= 0.4) return;

  try {
    await fetch(alertWebhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        requestId,
        counts,
        suspiciousRatio: Math.round(suspiciousRatio * 100) / 100,
        message: `Security alert: ${Math.round(suspiciousRatio * 100)}% of recent signatures are suspicious`
      })
    });
  } catch {
    // Webhook failures are non-fatal
  }
}
