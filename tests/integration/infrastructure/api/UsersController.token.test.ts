/**
 * Integration tests for UsersController — generateToken() and revokeToken().
 *
 * Tests:
 *   - generateToken() happy path → returns plaintext token + createdAt
 *   - generateToken() for non-admin → 403
 *   - generateToken() for missing user → 404
 *   - revokeToken() happy path → { revoked: true }
 *   - revokeToken() for missing user → 404
 *   - generated PAT has ztk_ prefix and correct length
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import type { User } from "@/lib/userStore";

// ── Hoist mocks ───────────────────────────────────────────────────────────────

const m = vi.hoisted(() => ({
  getUserById:    vi.fn<(id: string) => Promise<User | null>>(),
  setApiToken:    vi.fn<(id: string, hash: string) => Promise<void>>(),
  clearApiToken:  vi.fn<(id: string) => Promise<void>>(),
  // Provide stubs for all other imports used by the module
  getUsers:           vi.fn(),
  findUser:           vi.fn(),
  createUser:         vi.fn(),
  createExternalUser: vi.fn(),
  updateUser:         vi.fn(),
  deleteUser:         vi.fn(),
  updateUserFhirSync: vi.fn(),
  validateCredentials:vi.fn(),
}));

vi.mock("@/lib/userStore", () => ({
  getUsers:            m.getUsers,
  getUserById:         m.getUserById,
  findUser:            m.findUser,
  createUser:          m.createUser,
  createExternalUser:  m.createExternalUser,
  updateUser:          m.updateUser,
  deleteUser:          m.deleteUser,
  updateUserFhirSync:  m.updateUserFhirSync,
  validateCredentials: m.validateCredentials,
  setApiToken:         m.setApiToken,
  clearApiToken:       m.clearApiToken,
}));

vi.mock("@/infrastructure/fhir/PractitionerMapper", () => ({
  PractitionerMapper:  vi.fn(),
  practitionerMapper:  { syncUser: vi.fn() },
}));

const { UsersController } = await import(
  "@/infrastructure/api/controllers/UsersController"
);

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
  m.setApiToken.mockResolvedValue(undefined);
  m.clearApiToken.mockResolvedValue(undefined);
});

// ── generateToken() ───────────────────────────────────────────────────────────

describe("UsersController.generateToken()", () => {
  it("returns a token with ztk_ prefix and createdAt for admin user", async () => {
    m.getUserById.mockResolvedValue(makeAdmin());

    const ctrl   = new UsersController();
    const result = await ctrl.generateToken("u-001");

    expect("token" in result).toBe(true);
    if (!("token" in result)) return;
    expect(result.token).toMatch(/^ztk_[0-9a-f]{64}$/);
    expect(result.createdAt).toBeTruthy();
  });

  it("calls setApiToken with the hashed value (not the plaintext)", async () => {
    m.getUserById.mockResolvedValue(makeAdmin());

    const ctrl = new UsersController();
    const result = await ctrl.generateToken("u-001");

    if (!("token" in result)) throw new Error("expected token");
    expect(m.setApiToken).toHaveBeenCalledOnce();
    const [calledId, calledHash] = m.setApiToken.mock.calls[0]!;
    expect(calledId).toBe("u-001");
    // Hash must NOT equal the plaintext token
    expect(calledHash).not.toBe(result.token);
    // Hash must be a 64-char hex string (SHA-256)
    expect(calledHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns 404 when user does not exist", async () => {
    m.getUserById.mockResolvedValue(null);

    const ctrl   = new UsersController();
    const result = await ctrl.generateToken("missing");

    expect("httpStatus" in result).toBe(true);
    if (!("httpStatus" in result)) return;
    expect(result.httpStatus).toBe(404);
  });

  it("returns 403 when user is not admin", async () => {
    m.getUserById.mockResolvedValue(makeAdmin({ role: "user" }));

    const ctrl   = new UsersController();
    const result = await ctrl.generateToken("u-001");

    expect("httpStatus" in result).toBe(true);
    if (!("httpStatus" in result)) return;
    expect(result.httpStatus).toBe(403);
  });

  it("generates a unique token on every call", async () => {
    m.getUserById.mockResolvedValue(makeAdmin());

    const ctrl = new UsersController();
    const r1   = await ctrl.generateToken("u-001");
    const r2   = await ctrl.generateToken("u-001");

    if (!("token" in r1) || !("token" in r2)) throw new Error("expected tokens");
    expect(r1.token).not.toBe(r2.token);
  });
});

// ── revokeToken() ─────────────────────────────────────────────────────────────

describe("UsersController.revokeToken()", () => {
  it("returns { revoked: true } and calls clearApiToken", async () => {
    m.getUserById.mockResolvedValue(makeAdmin());

    const ctrl   = new UsersController();
    const result = await ctrl.revokeToken("u-001");

    expect("revoked" in result).toBe(true);
    if (!("revoked" in result)) return;
    expect(result.revoked).toBe(true);
    expect(m.clearApiToken).toHaveBeenCalledWith("u-001");
  });

  it("returns 404 when user does not exist", async () => {
    m.getUserById.mockResolvedValue(null);

    const ctrl   = new UsersController();
    const result = await ctrl.revokeToken("missing");

    expect("httpStatus" in result).toBe(true);
    if (!("httpStatus" in result)) return;
    expect(result.httpStatus).toBe(404);
  });
});
