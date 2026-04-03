/**
 * Integration tests for AuthTokenController.
 *
 * Tests:
 *   - exchange() happy path → returns accessToken + tokenType + expiresIn
 *   - exchange() invalid credentials → 401
 *   - exchange() non-admin user → 403
 *   - exchange() suspended user → 403
 *   - exchange() missing fields → 400
 *   - exchange() invalid expiresIn → 400
 *   - returned JWT is verifiable with UserJwtService
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import type { User } from "@/lib/userStore";

// ── Hoist mocks ───────────────────────────────────────────────────────────────

const m = vi.hoisted(() => ({
  verifyUser: vi.fn<(u: string, p: string) => Promise<User | null>>(),
}));

vi.mock("@/lib/userStore", () => ({
  verifyUser: m.verifyUser,
}));

// Import AFTER mocks
const { AuthTokenController } = await import(
  "@/infrastructure/api/controllers/AuthTokenController"
);
const { UserJwtService } = await import("@/infrastructure/auth/UserJwtService");

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeAdmin(overrides: Partial<User> = {}): User {
  return {
    id:             "u-001",
    username:       "admin",
    passwordHash:   "hash",
    salt:           "salt",
    createdAt:      "2024-01-01T00:00:00Z",
    role:           "admin",
    status:         "active",
    providerType:   "local",
    profile:        {},
    fhirSyncStatus: "not_synced",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTH_SECRET = "test-auth-token-controller-secret";
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AuthTokenController.exchange() — happy path", () => {
  it("returns an AccessTokenResponse for valid admin credentials", async () => {
    m.verifyUser.mockResolvedValue(makeAdmin());

    const ctrl   = new AuthTokenController();
    const result = await ctrl.exchange({ username: "admin", password: "secret" });

    expect("accessToken" in result).toBe(true);
    if (!("accessToken" in result)) return;
    expect(result.tokenType).toBe("Bearer");
    expect(result.expiresIn).toBe(86_400); // default 24h
    expect(result.accessToken).toBeTruthy();
  });

  it("returned JWT is valid and contains sub + role", async () => {
    m.verifyUser.mockResolvedValue(makeAdmin());

    const ctrl   = new AuthTokenController();
    const result = await ctrl.exchange({ username: "admin", password: "secret" });

    if (!("accessToken" in result)) throw new Error("expected token response");
    const jwtSvc  = new UserJwtService();
    const payload = jwtSvc.verify(result.accessToken);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe("u-001");
    expect(payload!.role).toBe("admin");
  });

  it("respects custom expiresIn", async () => {
    m.verifyUser.mockResolvedValue(makeAdmin());

    const ctrl   = new AuthTokenController();
    const result = await ctrl.exchange({ username: "admin", password: "secret", expiresIn: "7d" });

    if (!("accessToken" in result)) throw new Error("expected token response");
    expect(result.expiresIn).toBe(604_800); // 7 days in seconds
  });
});

describe("AuthTokenController.exchange() — error cases", () => {
  it("returns 401 for invalid credentials", async () => {
    m.verifyUser.mockResolvedValue(null);

    const ctrl   = new AuthTokenController();
    const result = await ctrl.exchange({ username: "admin", password: "wrong" });

    expect("httpStatus" in result).toBe(true);
    if (!("httpStatus" in result)) return;
    expect(result.httpStatus).toBe(401);
  });

  it("returns 403 for non-admin user", async () => {
    m.verifyUser.mockResolvedValue(makeAdmin({ role: "user" }));

    const ctrl   = new AuthTokenController();
    const result = await ctrl.exchange({ username: "user", password: "secret" });

    expect("httpStatus" in result).toBe(true);
    if (!("httpStatus" in result)) return;
    expect(result.httpStatus).toBe(403);
  });

  it("returns 403 for suspended admin", async () => {
    m.verifyUser.mockResolvedValue(makeAdmin({ status: "suspended" }));

    const ctrl   = new AuthTokenController();
    const result = await ctrl.exchange({ username: "admin", password: "secret" });

    expect("httpStatus" in result).toBe(true);
    if (!("httpStatus" in result)) return;
    expect(result.httpStatus).toBe(403);
  });

  it("returns 400 when username is empty", async () => {
    const ctrl   = new AuthTokenController();
    const result = await ctrl.exchange({ username: "", password: "secret" });

    expect("httpStatus" in result).toBe(true);
    if (!("httpStatus" in result)) return;
    expect(result.httpStatus).toBe(400);
  });

  it("returns 400 when password is empty", async () => {
    const ctrl   = new AuthTokenController();
    const result = await ctrl.exchange({ username: "admin", password: "" });

    expect("httpStatus" in result).toBe(true);
    if (!("httpStatus" in result)) return;
    expect(result.httpStatus).toBe(400);
  });

  it("returns 400 for an invalid expiresIn value", async () => {
    m.verifyUser.mockResolvedValue(makeAdmin());

    const ctrl   = new AuthTokenController();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await ctrl.exchange({ username: "admin", password: "secret", expiresIn: "2h" as any });

    expect("httpStatus" in result).toBe(true);
    if (!("httpStatus" in result)) return;
    expect(result.httpStatus).toBe(400);
  });
});
