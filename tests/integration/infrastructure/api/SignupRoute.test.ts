/**
 * Integration tests for the POST /api/signup route handler.
 *
 * Tests verify:
 *   - 201 returned with user data for valid credentials
 *   - Profile (firstName, lastName, gln) is forwarded to createUser
 *   - 400 returned when GLN does not contain exactly 13 digits
 *   - 400 returned when credentials fail validateCredentials
 *   - 409 returned on duplicate username
 *   - 503 returned when ALLOW_LOCAL_AUTH is true (server-side FS disabled)
 *
 * NextResponse is mocked as a thin wrapper around the standard Response API
 * so that no Next.js server runtime is required.
 */

import { vi } from "vitest";
import type { User, UserProfile } from "@/lib/userStore";

// ── Mock next/server ──────────────────────────────────────────────────────────

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { "content-type": "application/json" },
      }),
  },
}));

// ── Hoist mock references before vi.mock factory ──────────────────────────────

const m = vi.hoisted(() => ({
  createUser:          vi.fn<(u: string, p: string, profile?: UserProfile) => Promise<User>>(),
  validateCredentials: vi.fn<(u: string, p: string) => string | null>(),
  allowLocalAuth:      { value: false },
}));

vi.mock("@/lib/userStore", () => ({
  createUser:          m.createUser,
  validateCredentials: m.validateCredentials,
}));

vi.mock("@/lib/appConfig", () => ({
  get ALLOW_LOCAL_AUTH() { return m.allowLocalAuth.value; },
}));

// ── Import route handler after mocks are in place ─────────────────────────────

import { POST } from "@/app/api/signup/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id:           "u-001",
    username:     "testuser",
    passwordHash: "hash",
    salt:         "salt",
    createdAt:    "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.allowLocalAuth.value = false;
  m.validateCredentials.mockReturnValue(null); // valid by default
});

// ─────────────────────────────────────────────────────────────────────────────
// Happy path
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/signup — happy path", () => {
  it("returns 201 with user data for valid username + password", async () => {
    m.createUser.mockResolvedValue(makeUser());

    const res = await POST(makeRequest({ username: "testuser", password: "Test1234!" }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.user.username).toBe("testuser");
  });

  it("forwards firstName, lastName and gln to createUser as profile", async () => {
    m.createUser.mockResolvedValue(makeUser({ profile: { firstName: "Hans", lastName: "Muster", gln: "7601002145985" } }));

    await POST(makeRequest({
      username:  "hans.muster",
      password:  "Test1234!",
      firstName: "Hans",
      lastName:  "Muster",
      gln:       "7601002145985",
    }));

    expect(m.createUser).toHaveBeenCalledWith(
      "hans.muster",
      "Test1234!",
      { firstName: "Hans", lastName: "Muster", gln: "7601002145985" },
    );
  });

  it("calls createUser without profile when no optional fields are provided", async () => {
    m.createUser.mockResolvedValue(makeUser());

    await POST(makeRequest({ username: "testuser", password: "Test1234!" }));

    expect(m.createUser).toHaveBeenCalledWith("testuser", "Test1234!", undefined);
  });

  it("includes only non-empty profile fields", async () => {
    m.createUser.mockResolvedValue(makeUser());

    await POST(makeRequest({ username: "testuser", password: "Test1234!", gln: "7601002145985" }));

    expect(m.createUser).toHaveBeenCalledWith(
      "testuser",
      "Test1234!",
      { gln: "7601002145985" },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GLN validation
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/signup — GLN validation", () => {
  it("returns 400 when GLN has fewer than 13 digits", async () => {
    const res = await POST(makeRequest({ username: "testuser", password: "Test1234!", gln: "123" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(m.createUser).not.toHaveBeenCalled();
  });

  it("returns 400 when GLN has more than 13 digits", async () => {
    const res = await POST(makeRequest({ username: "testuser", password: "Test1234!", gln: "76010021459850000" }));

    expect(res.status).toBe(400);
    expect(m.createUser).not.toHaveBeenCalled();
  });

  it("returns 400 when GLN contains non-digit characters", async () => {
    const res = await POST(makeRequest({ username: "testuser", password: "Test1234!", gln: "760100214598A" }));

    expect(res.status).toBe(400);
    expect(m.createUser).not.toHaveBeenCalled();
  });

  it("accepts a valid 13-digit GLN", async () => {
    m.createUser.mockResolvedValue(makeUser());

    const res = await POST(makeRequest({ username: "testuser", password: "Test1234!", gln: "7601002145985" }));

    expect(res.status).toBe(201);
    expect(m.createUser).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Error cases
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/signup — error cases", () => {
  it("returns 400 when validateCredentials returns an error", async () => {
    m.validateCredentials.mockReturnValue("Password must be at least 8 characters");

    const res = await POST(makeRequest({ username: "testuser", password: "short" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toContain("Password");
    expect(m.createUser).not.toHaveBeenCalled();
  });

  it("returns 409 when username already exists", async () => {
    m.createUser.mockRejectedValue(new Error("Username already exists"));

    const res = await POST(makeRequest({ username: "testuser", password: "Test1234!" }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
  });

  it("returns 503 when ALLOW_LOCAL_AUTH is true", async () => {
    m.allowLocalAuth.value = true;

    const res = await POST(makeRequest({ username: "testuser", password: "Test1234!" }));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(m.createUser).not.toHaveBeenCalled();
  });
});
