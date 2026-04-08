interface SecurityLogEvent {
  route: string;
  action: string;
  decision: "allow" | "flag" | "block";
  reasonCodes: string[];
  hashedIp?: string;
  hashedUserAgent?: string;
  hashedFingerprint?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export function logSecurityEvent(event: SecurityLogEvent) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      type: "security_event",
      ...event
    })
  );
}

export async function emitSecurityMetric(
  name: string,
  value: number,
  tags: Record<string, string | number | boolean | undefined>
) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      type: "security_metric",
      name,
      value,
      tags
    })
  );
}
