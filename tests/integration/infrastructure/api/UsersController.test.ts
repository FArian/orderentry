/**
 * Integration tests for UsersController.
 *
 * UsersController reads/writes the file-based user store (userStore.ts)
 * rather than using an injectable fetchFn. To keep tests isolated and
 * hermetic we mock the userStore module using Vitest's vi.mock() with
 * vi.hoisted() so mock references are available inside the factory.
 *
 * Tests verify:
 *   - list()    — filtering, pagination, error propagation
 *   - getById() — happy path and not-found
 *   - create()  — local user, external user, duplicate detection
 *   - update()  — patch logic, not-found
 *   - delete()  — happy path and not-found
 */

import { vi } from "vitest";
import { UsersController } from "@/infrastructure/api/controllers/UsersController";
import type { User } from "@/lib/userStore";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id:             "u-001",
    username:       "testuser",
    passwordHash:   "hash",
    salt:           "salt",
    createdAt:      "2024-01-01T00:00:00Z",
    role:           "user",
    status:         "active",
    providerType:   "local",
    profile:        {},
    fhirSyncStatus: "not_synced",
    ...overrides,
  };
}

// ── Hoist mock functions before module factory runs ───────────────────────────

const m = vi.hoisted(() => ({
  getUsers:           vi.fn<() => Promise<User[]>>(),
  getUserById:        vi.fn<(id: string) => Promise<User | null>>(),
  findUser:           vi.fn<(u: string) => Promise<User | null>>(),
  createUser:         vi.fn<(u: string, p: string) => Promise<User>>(),
  createExternalUser: vi.fn(),
  updateUser:         vi.fn<(id: string, patch: Partial<User>) => Promise<User>>(),
  deleteUser:         vi.fn<(id: string) => Promise<void>>(),
  updateUserFhirSync: vi.fn(),
  validateCredentials:vi.fn<(u: string, p: string) => string | null>(),
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
}));

vi.mock("@/infrastructure/fhir/PractitionerMapper", () => ({
  PractitionerMapper: vi.fn(),
  practitionerMapper: { syncUser: vi.fn() },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeController() {
  return new UsersController(undefined, undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// list()
// ─────────────────────────────────────────────────────────────────────────────

describe("UsersController.list()", () => {
  it("returns all users when no filters are applied", async () => {
    const users = [
      makeUser({ id: "u-1", username: "alice" }),
      makeUser({ id: "u-2", username: "bob"   }),
    ];
    m.getUsers.mockResolvedValue(users);

    const result = await makeController().list({});

    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
  });

  it("filters by username query string (case-insensitive)", async () => {
    m.getUsers.mockResolvedValue([
      makeUser({ id: "u-1", username: "alice" }),
      makeUser({ id: "u-2", username: "bob"   }),
    ]);

    const result = await makeController().list({ q: "ALI" });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.username).toBe("alice");
  });

  it("filters by role", async () => {
    m.getUsers.mockResolvedValue([
      makeUser({ id: "u-1", username: "alice", role: "admin" }),
      makeUser({ id: "u-2", username: "bob",   role: "user"  }),
    ]);

    const result = await makeController().list({ role: "admin" });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.username).toBe("alice");
  });

  it("filters by status", async () => {
    m.getUsers.mockResolvedValue([
      makeUser({ id: "u-1", username: "alice", status: "active"    }),
      makeUser({ id: "u-2", username: "bob",   status: "suspended" }),
    ]);

    const result = await makeController().list({ status: "suspended" });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.username).toBe("bob");
  });

  it("respects page and pageSize", async () => {
    const users = Array.from({ length: 5 }, (_, i) =>
      makeUser({ id: `u-${i}`, username: `user${i}` })
    );
    m.getUsers.mockResolvedValue(users);

    const result = await makeController().list({ page: 2, pageSize: 2 });

    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(5);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(2);
  });

  it("returns httpStatus 500 and error message when userStore throws", async () => {
    m.getUsers.mockRejectedValue(new Error("disk read failed"));

    const result = await makeController().list({});

    expect(result.httpStatus).toBe(500);
    expect(result.error).toContain("disk read failed");
    expect(result.data).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getById()
// ─────────────────────────────────────────────────────────────────────────────

describe("UsersController.getById()", () => {
  it("returns a mapped DTO for an existing user", async () => {
    m.getUserById.mockResolvedValue(
      makeUser({ id: "u-abc", username: "alice", role: "admin" })
    );

    const result = await makeController().getById("u-abc");

    expect("id" in result).toBe(true);
    if ("id" in result) {
      expect(result.id).toBe("u-abc");
      expect(result.username).toBe("alice");
      expect(result.role).toBe("admin");
    }
  });

  it("returns 404 when user does not exist", async () => {
    m.getUserById.mockResolvedValue(null);

    const result = await makeController().getById("missing");

    expect("httpStatus" in result).toBe(true);
    if ("httpStatus" in result) {
      expect(result.httpStatus).toBe(404);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// create()
// ─────────────────────────────────────────────────────────────────────────────

describe("UsersController.create()", () => {
  it("creates a local user successfully", async () => {
    m.findUser.mockResolvedValue(null);
    m.validateCredentials.mockReturnValue(null);
    m.createUser.mockResolvedValue(makeUser({ id: "u-new", username: "newuser" }));

    const result = await makeController().create({
      username:     "newuser",
      password:     "securepass1",
      providerType: "local",
    });

    expect("id" in result).toBe(true);
    if ("id" in result) expect(result.username).toBe("newuser");
  });

  it("returns 409 when username already exists", async () => {
    m.findUser.mockResolvedValue(makeUser());

    const result = await makeController().create({ username: "testuser", password: "pass" });

    expect("httpStatus" in result && result.httpStatus).toBe(409);
  });

  it("returns 400 when credentials fail validation", async () => {
    m.findUser.mockResolvedValue(null);
    m.validateCredentials.mockReturnValue("Password must be at least 8 characters");

    const result = await makeController().create({ username: "newuser", password: "short" });

    expect("httpStatus" in result && result.httpStatus).toBe(400);
    if ("error" in result) expect(result.error).toContain("Password");
  });

  it("returns 400 when externalId is missing for external provider", async () => {
    m.findUser.mockResolvedValue(null);

    const result = await makeController().create({
      username:     "ldapuser",
      providerType: "external",
    });

    expect("httpStatus" in result && result.httpStatus).toBe(400);
  });

  it("returns 400 when username is empty", async () => {
    const result = await makeController().create({ username: "" });

    expect("httpStatus" in result && result.httpStatus).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// update()
// ─────────────────────────────────────────────────────────────────────────────

describe("UsersController.update()", () => {
  it("updates an existing user's role and status", async () => {
    const existing = makeUser({ id: "u-001", role: "user",  status: "active"    });
    const updated  = makeUser({ id: "u-001", role: "admin", status: "suspended" });
    m.getUserById.mockResolvedValue(existing);
    m.updateUser.mockResolvedValue(updated);

    const result = await makeController().update("u-001", { role: "admin", status: "suspended" });

    expect("id" in result).toBe(true);
    if ("id" in result) {
      expect(result.role).toBe("admin");
      expect(result.status).toBe("suspended");
    }
    expect(m.updateUser).toHaveBeenCalledWith(
      "u-001",
      expect.objectContaining({ role: "admin", status: "suspended" })
    );
  });

  it("returns 404 when updating a non-existent user", async () => {
    m.getUserById.mockResolvedValue(null);

    const result = await makeController().update("missing", { role: "admin" });

    expect("httpStatus" in result && result.httpStatus).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// delete()
// ─────────────────────────────────────────────────────────────────────────────

describe("UsersController.delete()", () => {
  it("deletes an existing user and returns { deleted: true }", async () => {
    m.getUserById.mockResolvedValue(makeUser());
    m.deleteUser.mockResolvedValue(undefined);

    const result = await makeController().delete("u-001");

    expect(result.deleted).toBe(true);
    expect(m.deleteUser).toHaveBeenCalledWith("u-001");
  });

  it("returns { deleted: false } with 404 when user not found", async () => {
    m.getUserById.mockResolvedValue(null);

    const result = await makeController().delete("missing");

    expect(result.deleted).toBe(false);
    expect(result.httpStatus).toBe(404);
  });
});
