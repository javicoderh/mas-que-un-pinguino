import { describe, expect, it } from "vitest";
import {
  validateRut,
  normalizeText,
  normalizeEmail,
  normalizeRut,
  looksLikeRepeatedGarbage,
  looksMeaningless
} from "../normalization";

describe("validateRut", () => {
  it("accepts valid RUTs", () => {
    // Computed valid RUTs: body|expected_dv
    // 12345678 (8-digit body) → DV=5, 7654321 (7-digit body) → DV=6, 11111111 (8-digit body) → DV=1
    expect(validateRut("12.345.678-5")).toBe(true);
    expect(validateRut("11.111.111-1")).toBe(true);
    expect(validateRut("7.654.321-6")).toBe(true);
    expect(validateRut("12.345.678-9")).toBe(false); // wrong check digit
  });

  it("rejects invalid RUTs", () => {
    expect(validateRut("12345678-0")).toBe(false);
    expect(validateRut("abc")).toBe(false);
    expect(validateRut("")).toBe(false);
    expect(validateRut("1234-5")).toBe(false);
  });

  it("works with and without dots and dashes", () => {
    expect(validateRut("12.345.678-9")).toBe(validateRut("123456789"));
    expect(validateRut("7.654.321-K")).toBe(validateRut("7654321K"));
  });
});

describe("normalizeText", () => {
  it("trims whitespace", () => {
    expect(normalizeText("  hello  ")).toBe("hello");
  });

  it("normalizes multiple spaces", () => {
    expect(normalizeText("a  b   c")).toBe("a b c");
  });

  it("applies NFKC normalization", () => {
    expect(normalizeText("\uFB01")).toBe("fi");
  });
});

describe("normalizeEmail", () => {
  it("lowercases email", () => {
    expect(normalizeEmail("USER@EXAMPLE.COM")).toBe("user@example.com");
  });

  it("trims whitespace", () => {
    expect(normalizeEmail("  user@example.com  ")).toBe("user@example.com");
  });
});

describe("normalizeRut", () => {
  it("removes dots and dashes and uppercases", () => {
    expect(normalizeRut("12.345.678-k")).toBe("12345678K");
  });

  it("handles already clean RUT", () => {
    expect(normalizeRut("12345678K")).toBe("12345678K");
  });
});

describe("looksLikeRepeatedGarbage", () => {
  it("detects repeated characters", () => {
    // First pattern: ≥6 consecutive repetitions of same char
    expect(looksLikeRepeatedGarbage("aaaaaaa")).toBe(true);
    expect(looksLikeRepeatedGarbage("aaaaaa")).toBe(true);
    // Second pattern: entire string is a single char repeated
    expect(looksLikeRepeatedGarbage("aaaaa")).toBe(true);
    expect(looksLikeRepeatedGarbage("aaaa")).toBe(true);
  });

  it("accepts normal text", () => {
    expect(looksLikeRepeatedGarbage("Juan Carlos")).toBe(false);
    expect(looksLikeRepeatedGarbage("Gonzalez")).toBe(false);
  });
});

describe("looksMeaningless", () => {
  it("detects empty strings", () => {
    expect(looksMeaningless("")).toBe(true);
  });

  it("detects repeated garbage", () => {
    expect(looksMeaningless("aaaaaaaaa")).toBe(true);
  });

  it("detects strings with no letter content", () => {
    expect(looksMeaningless("123")).toBe(true);
    expect(looksMeaningless("!@#")).toBe(true);
  });

  it("accepts normal names", () => {
    expect(looksMeaningless("Juan")).toBe(false);
    expect(looksMeaningless("González")).toBe(false);
  });
});
