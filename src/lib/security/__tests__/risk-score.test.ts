import { describe, expect, it } from "vitest";
import { scoreSignatureRisk } from "../risk-score";
import type { RiskSignalInput } from "../risk-score";

const cleanInput: RiskSignalInput = {
  submitTimeMs: 10_000,
  minSubmitTimeMs: 2_500,
  honeypotFilled: false,
  invalidOrigin: false,
  suspiciousUserAgent: false,
  duplicateDetected: false,
  repeatedIpCooldownHit: false,
  ipBurstCount: 0,
  fingerprintBurstCount: 0,
  captchaVerified: false,
  highProtectionMode: false
};

describe("scoreSignatureRisk", () => {
  it("allows clean submission", () => {
    const result = scoreSignatureRisk(cleanInput);
    expect(result.decision).toBe("allow");
    expect(result.score).toBe(0);
    expect(result.reasonCodes).toHaveLength(0);
  });

  it("blocks honeypot filled", () => {
    const result = scoreSignatureRisk({ ...cleanInput, honeypotFilled: true });
    expect(result.decision).toBe("block");
    expect(result.reasonCodes).toContain("honeypot_filled");
  });

  it("flags fast submit combined with invalid origin", () => {
    // Moderately fast (25pts) + invalid origin (35pts) = 60pts → flag
    const result = scoreSignatureRisk({
      ...cleanInput,
      submitTimeMs: 2_000,
      minSubmitTimeMs: 2_500,
      invalidOrigin: true
    });
    expect(result.decision).toBe("flag");
    expect(result.reasonCodes).toContain("submitted_too_fast");
  });

  it("adds submitted_too_fast reason code for moderately fast submit", () => {
    // 25pts alone is below flag threshold (35), but reason code should still appear
    const result = scoreSignatureRisk({
      ...cleanInput,
      submitTimeMs: 2_000,
      minSubmitTimeMs: 2_500
    });
    expect(result.reasonCodes).toContain("submitted_too_fast");
    expect(result.score).toBe(25);
  });

  it("blocks very fast submit combined with other signals", () => {
    const result = scoreSignatureRisk({
      ...cleanInput,
      submitTimeMs: 100,
      minSubmitTimeMs: 2_500,
      invalidOrigin: true
    });
    expect(result.decision).toBe("block");
    expect(result.reasonCodes).toContain("submitted_too_fast");
    expect(result.reasonCodes).toContain("invalid_origin");
  });

  it("flags suspicious user agent combined with invalid origin", () => {
    // suspicious UA (25pts) + invalid origin (35pts) = 60pts → flag
    const result = scoreSignatureRisk({ ...cleanInput, suspiciousUserAgent: true, invalidOrigin: true });
    expect(result.decision).toBe("flag");
    expect(result.reasonCodes).toContain("suspicious_user_agent");
  });

  it("adds suspicious_user_agent reason below flag threshold alone", () => {
    // 25pts alone is below flag threshold (35)
    const result = scoreSignatureRisk({ ...cleanInput, suspiciousUserAgent: true });
    expect(result.score).toBe(25);
    expect(result.reasonCodes).toContain("suspicious_user_agent");
  });

  it("blocks duplicate signature", () => {
    const result = scoreSignatureRisk({ ...cleanInput, duplicateDetected: true });
    expect(result.decision).toBe("block");
    expect(result.reasonCodes).toContain("duplicate_signature");
  });

  it("adds captcha_missing score in high protection mode", () => {
    const result = scoreSignatureRisk({
      ...cleanInput,
      highProtectionMode: true,
      captchaVerified: false
    });
    expect(result.reasonCodes).toContain("captcha_missing");
  });

  it("captcha_missing does not trigger in high protection mode if verified", () => {
    const result = scoreSignatureRisk({
      ...cleanInput,
      highProtectionMode: true,
      captchaVerified: true
    });
    expect(result.reasonCodes).not.toContain("captcha_missing");
  });

  it("combines multiple signals to reach block threshold", () => {
    const result = scoreSignatureRisk({
      ...cleanInput,
      invalidOrigin: true,
      suspiciousUserAgent: true,
      fingerprintBurstCount: 3
    });
    expect(result.decision).toBe("block");
  });
});
