/**
 * Unit tests for BearerAuthGuard.
 *
 * Tests:
 *   - resolve() with PAT → user lookup via getUsers mock
 *   - resolve() with JWT → stateless verification
 *   - resolve() with absent / malformed header → null
 *   - suspended user with valid PAT → null
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import type { User } from "@/lib/userStore";
import { ApiTokenService } from "@/infrastructure/auth/ApiTokenService";
import { UserJwtService } from "@/infrastructure/auth/UserJwtService";

// ── Mock userStore BEFORE importing BearerAuthGuard ───────────────────────────

const m = vi.hoisted(() => ({
  getUsers: vi.fn<() => Promise<User[]>>(),
}));

vi.mock("@/lib/userStore", () => ({
  getUsers: m.getUsers,
}));

// Import AFTER mock is registered
const { BearerAuthGuard } = await import("@/infrastructure/auth/BearerAuthGuard");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const patSvc = new ApiTokenService();
const jwtSvc = new UserJwtService();

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id:           "u-001",
    username:     "admin",
    passwordHash: "hash",
    salt:         "salt",
    createdAt:    "2024-01-01T00:00:00Z",
    role:         "admin",
    status:       "active",
    providerType: "local",
    profile:      {},
    fhirSyncStatus: "not_synced",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTH_SECRET = "test-bearer-guard-secret";
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("BearerAuthGuard.resolve() — no header", () => {
  it("returns null for null header", async () => {
    const guard = new BearerAuthGuard();
    expect(await guard.resolve(null)).toBeNull();
  });

  it("returns null for undefined header", async () => {
    const guard = new BearerAuthGuard();
    expect(await guard.resolve(undefined)).toBeNull();
  });

  it("returns null when Authorization is not Bearer", async () => {
    const guard = new BearerAuthGuard();
    expect(await guard.resolve("Basic dXNlcjpwYXNz")).toBeNull();
  });
});

describe("BearerAuthGuard.resolve() — PAT", () => {
  it("resolves a valid PAT to the matching user session", async () => {
    const plaintext = patSvc.generate();
    const hash      = patSvc.hash(plaintext);
    const user      = makeUser({ apiTokenHash: hash });
    m.getUsers.mockResolvedValue([user]);

    const guard  = new BearerAuthGuard();
    const session = await guard.resolve(`Bearer ${plaintext}`);

    expect(session).not.toBeNull();
    expect(session!.sub).toBe("u-001");
    expect(session!.role).toBe("admin");
  });

  it("returns null when no user has a matching token", async () => {
    const plaintext = patSvc.generate();
    const user      = makeUser({ apiTokenHash: patSvc.hash(patSvc.generate()) }); // different hash
    m.getUsers.mockResolvedValue([user]);

    const guard = new BearerAuthGuard();
    expect(await guard.resolve(`Bearer ${plaintext}`)).toBeNull();
  });

  it("returns null when the matching user is suspended", async () => {
    const plaintext = patSvc.generate();
    const hash      = patSvc.hash(plaintext);
    const user      = makeUser({ apiTokenHash: hash, status: "suspended" });
    m.getUsers.mockResolvedValue([user]);

    const guard = new BearerAuthGuard();
    expect(await guard.resolve(`Bearer ${plaintext}`)).toBeNull();
  });

  it("returns null when user has no apiTokenHash", async () => {
    const plaintext = patSvc.generate();
    m.getUsers.mockResolvedValue([makeUser()]); // no apiTokenHash

    const guard = new BearerAuthGuard();
    expect(await guard.resolve(`Bearer ${plaintext}`)).toBeNull();
  });
});

describe("BearerAuthGuard.resolve() — JWT", () => {
  it("resolves a valid JWT to a session", async () => {
    const token = jwtSvc.sign({ sub: "u-002", username: "service", role: "admin" }, 3600);

    const guard   = new BearerAuthGuard();
    const session = await guard.resolve(`Bearer ${token}`);

    expect(session).not.toBeNull();
    expect(session!.sub).toBe("u-002");
    expect(session!.role).toBe("admin");
  });

  it("returns null for an expired JWT", async () => {
    const token = jwtSvc.sign({ sub: "u-002", username: "service", role: "admin" }, -1);

    const guard = new BearerAuthGuard();
    expect(await guard.resolve(`Bearer ${token}`)).toBeNull();
  });

  it("returns null for a malformed JWT", async () => {
    const guard = new BearerAuthGuard();
    expect(await guard.resolve("Bearer not.a.valid.jwt")).toBeNull();
  });
});
