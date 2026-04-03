/**
 * Unit tests for ApiTokenService.
 *
 * Tests:
 *   - generate() — token format, uniqueness, prefix
 *   - hash()     — deterministic SHA-256
 *   - verify()   — timing-safe match, mismatch, malformed input
 *   - isPat()    — static prefix check
 */

import { describe, it, expect } from "vitest";
import { ApiTokenService } from "@/infrastructure/auth/ApiTokenService";

const svc = new ApiTokenService();

describe("ApiTokenService.generate()", () => {
  it("returns a string starting with ztk_", () => {
    const token = svc.generate();
    expect(token.startsWith("ztk_")).toBe(true);
  });

  it("has exactly 68 characters (ztk_ + 64 hex)", () => {
    const token = svc.generate();
    expect(token).toHaveLength(68);
  });

  it("generates unique tokens on every call", () => {
    const tokens = new Set(Array.from({ length: 10 }, () => svc.generate()));
    expect(tokens.size).toBe(10);
  });
});

describe("ApiTokenService.hash()", () => {
  it("returns a 64-character hex string", () => {
    const hash = svc.hash("ztk_abc");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same input", () => {
    const token = svc.generate();
    expect(svc.hash(token)).toBe(svc.hash(token));
  });

  it("produces different hashes for different tokens", () => {
    expect(svc.hash("ztk_aaa")).not.toBe(svc.hash("ztk_bbb"));
  });
});

describe("ApiTokenService.verify()", () => {
  it("returns true when token matches the stored hash", () => {
    const token = svc.generate();
    const hash  = svc.hash(token);
    expect(svc.verify(token, hash)).toBe(true);
  });

  it("returns false when token does not match the stored hash", () => {
    const token  = svc.generate();
    const other  = svc.generate();
    const hash   = svc.hash(token);
    expect(svc.verify(other, hash)).toBe(false);
  });

  it("returns false for a malformed stored hash", () => {
    const token = svc.generate();
    expect(svc.verify(token, "not-valid-hex")).toBe(false);
  });
});

describe("ApiTokenService.isPat()", () => {
  it("returns true for ztk_ prefix", () => {
    expect(ApiTokenService.isPat("ztk_abc")).toBe(true);
  });

  it("returns false for JWT tokens", () => {
    expect(ApiTokenService.isPat("eyJhbGciOiJIUzI1NiJ9.payload.sig")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(ApiTokenService.isPat("")).toBe(false);
  });
});
