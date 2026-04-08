import { describe, expect, it, vi } from "vitest";

// Mock the config before importing dedupe
vi.mock("../config", () => ({
  securityConfig: {
    hashSecret: "test-secret-for-unit-tests"
  }
}));

import { buildSignatureDedupeKeys } from "../dedupe";

describe("buildSignatureDedupeKeys", () => {
  const baseInput = {
    normalizedEmail: "user@example.com",
    normalizedIdentity: "juan gonzalez|cl",
    normalizedRut: "123456789",
    ipHash: "abc123"
  };

  it("generates distinct hashes per field", async () => {
    const keys = await buildSignatureDedupeKeys(baseInput);
    const values = [keys.emailHash, keys.identityHash, keys.rutHash, keys.ipEmailHash];
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(4);
  });

  it("produces the same hash for the same input", async () => {
    const keys1 = await buildSignatureDedupeKeys(baseInput);
    const keys2 = await buildSignatureDedupeKeys(baseInput);
    expect(keys1.emailHash).toBe(keys2.emailHash);
    expect(keys1.identityHash).toBe(keys2.identityHash);
    expect(keys1.rutHash).toBe(keys2.rutHash);
    expect(keys1.ipEmailHash).toBe(keys2.ipEmailHash);
  });

  it("produces different hashes for different emails", async () => {
    const keys1 = await buildSignatureDedupeKeys(baseInput);
    const keys2 = await buildSignatureDedupeKeys({ ...baseInput, normalizedEmail: "other@example.com" });
    expect(keys1.emailHash).not.toBe(keys2.emailHash);
    expect(keys1.identityHash).toBe(keys2.identityHash);
  });

  it("produces different hashes for different identities", async () => {
    const keys1 = await buildSignatureDedupeKeys(baseInput);
    const keys2 = await buildSignatureDedupeKeys({ ...baseInput, normalizedIdentity: "ana torres|cl" });
    expect(keys1.identityHash).not.toBe(keys2.identityHash);
    expect(keys1.emailHash).toBe(keys2.emailHash);
  });

  it("rutHash reflects rut value (intl variant with empty rut still hashes differently)", async () => {
    const clKeys = await buildSignatureDedupeKeys(baseInput);
    const intlKeys = await buildSignatureDedupeKeys({ ...baseInput, normalizedRut: "" });
    // For intl variant, normalizedRut is empty string — hash should differ
    expect(clKeys.rutHash).not.toBe(intlKeys.rutHash);
  });

  it("ipEmailHash combines ip and email", async () => {
    const keys1 = await buildSignatureDedupeKeys(baseInput);
    const keys2 = await buildSignatureDedupeKeys({ ...baseInput, ipHash: "different-ip" });
    expect(keys1.ipEmailHash).not.toBe(keys2.ipEmailHash);
  });
});
