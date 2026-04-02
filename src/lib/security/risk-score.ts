export type RiskDecision = "allow" | "flag" | "block";

export interface RiskSignalInput {
  submitTimeMs: number;
  minSubmitTimeMs: number;
  honeypotFilled: boolean;
  invalidOrigin: boolean;
  suspiciousUserAgent: boolean;
  duplicateDetected: boolean;
  repeatedIpCooldownHit: boolean;
  ipBurstCount: number;
  fingerprintBurstCount: number;
  captchaVerified: boolean;
  highProtectionMode: boolean;
}

export interface RiskScoreResult {
  decision: RiskDecision;
  score: number;
  reasonCodes: string[];
}

export function scoreSignatureRisk(input: RiskSignalInput): RiskScoreResult {
  let score = 0;
  const reasonCodes: string[] = [];

  if (input.honeypotFilled) {
    score += 100;
    reasonCodes.push("honeypot_filled");
  }

  if (input.submitTimeMs < input.minSubmitTimeMs) {
    score += input.submitTimeMs < Math.max(800, input.minSubmitTimeMs / 2) ? 70 : 25;
    reasonCodes.push("submitted_too_fast");
  }

  if (input.invalidOrigin) {
    score += 35;
    reasonCodes.push("invalid_origin");
  }

  if (input.suspiciousUserAgent) {
    score += 25;
    reasonCodes.push("suspicious_user_agent");
  }

  if (input.duplicateDetected) {
    score += 80;
    reasonCodes.push("duplicate_signature");
  }

  if (input.repeatedIpCooldownHit) {
    score += 30;
    reasonCodes.push("duplicate_ip_cooldown");
  }

  if (input.ipBurstCount >= 3) {
    score += 15;
    reasonCodes.push("ip_burst_activity");
  }

  if (input.fingerprintBurstCount >= 2) {
    score += 25;
    reasonCodes.push("fingerprint_reuse");
  }

  if (input.highProtectionMode && !input.captchaVerified) {
    score += 35;
    reasonCodes.push("captcha_missing");
  }

  if (score >= 80) {
    return { decision: "block", score, reasonCodes };
  }

  if (score >= 35) {
    return { decision: "flag", score, reasonCodes };
  }

  return { decision: "allow", score, reasonCodes };
}
