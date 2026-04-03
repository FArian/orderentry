/**
 * Unit tests for UserJwtService.
 *
 * Tests:
 *   - sign()   — produces three-part JWT, encodes payload fields
 *   - verify() — valid token, expired token, tampered signature, wrong secret, malformed
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { UserJwtService } from "@/infrastructure/auth/UserJwtService";

const svc = new UserJwtService();

const BASE_PAYLOAD = { sub: "u-001", username: "admin", role: "admin" };

beforeEach(() => {
  process.env.AUTH_SECRET = "test-secret-for-unit-tests";
});

afterEach(() => {
  delete process.env.AUTH_SECRET;
});

describe("UserJwtService.sign()", () => {
  it("returns a three-part dot-separated string", () => {
    const token = svc.sign(BASE_PAYLOAD, 3600);
    expect(token.split(".")).toHaveLength(3);
  });

  it("encodes sub, username, and role in payload", () => {
    const token   = svc.sign(BASE_PAYLOAD, 3600);
    const [, b64] = token.split(".");
    const payload = JSON.parse(Buffer.from(b64!, "base64").toString("utf8")) as Record<string, unknown>;
    expect(payload.sub).toBe("u-001");
    expect(payload.username).toBe("admin");
    expect(payload.role).toBe("admin");
  });

  it("sets exp approximately equal to now + expiresInSeconds", () => {
    const before = Math.floor(Date.now() / 1000);
    const token  = svc.sign(BASE_PAYLOAD, 3600);
    const after  = Math.floor(Date.now() / 1000);
    const [, b64] = token.split(".");
    const payload = JSON.parse(Buffer.from(b64!, "base64").toString("utf8")) as { exp: number; iat: number };
    expect(payload.exp).toBeGreaterThanOrEqual(before + 3600);
    expect(payload.exp).toBeLessThanOrEqual(after + 3600);
    expect(payload.iat).toBeGreaterThanOrEqual(before);
    expect(payload.iat).toBeLessThanOrEqual(after);
  });
});

describe("UserJwtService.verify()", () => {
  it("returns the payload for a valid token", () => {
    const token   = svc.sign(BASE_PAYLOAD, 3600);
    const payload = svc.verify(token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe("u-001");
    expect(payload!.role).toBe("admin");
  });

  it("returns null for an expired token", () => {
    const token = svc.sign(BASE_PAYLOAD, -1); // already expired
    expect(svc.verify(token)).toBeNull();
  });

  it("returns null when the signature is tampered", () => {
    const token = svc.sign(BASE_PAYLOAD, 3600);
    const parts = token.split(".");
    const tampered = `${parts[0]}.${parts[1]}.invalidsig`;
    expect(svc.verify(tampered)).toBeNull();
  });

  it("returns null when signed with a different secret", () => {
    const token = svc.sign(BASE_PAYLOAD, 3600);

    // Temporarily change secret so the service verifies with a different key
    process.env.AUTH_SECRET = "different-secret";
    expect(svc.verify(token)).toBeNull();
  });

  it("returns null for a malformed token (< 3 parts)", () => {
    expect(svc.verify("only.two")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(svc.verify("")).toBeNull();
  });

  it("returns null when payload is missing sub or role", () => {
    // Build a token with minimal payload (missing role)
    const corrupt = svc.sign({ sub: "", username: "x", role: "" }, 3600);
    // sub and role are empty strings — verify should reject them
    expect(svc.verify(corrupt)).toBeNull();
  });
});
