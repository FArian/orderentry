/**
 * Integration tests for the GET /api/practitioners route handler.
 *
 * Tests verify:
 *   - When user has orgFhirId: practitioners are fetched via PractitionerRole?organization=...
 *     and filtered to only those referenced by a matching PractitionerRole
 *   - When user has no orgFhirId: all practitioners are returned (fallback)
 *   - When no session exists: all practitioners are returned (fallback)
 *   - FHIR errors propagate with the correct HTTP status
 *   - Name search query param is forwarded correctly in both paths
 *
 * NextResponse, auth, userStore and global fetch are all mocked.
 */

import { vi } from "vitest";
import type { User } from "@/lib/userStore";

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
  getSessionFromCookies: vi.fn(),
  getUserById:           vi.fn<(id: string) => Promise<User | undefined>>(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionFromCookies: m.getSessionFromCookies,
}));

vi.mock("@/lib/userStore", () => ({
  getUserById: m.getUserById,
}));

vi.mock("@/lib/fhir", () => ({
  FHIR_BASE: "http://fhir-test:8080/fhir",
}));

// ── Import route handler after mocks ──────────────────────────────────────────

import { GET } from "@/app/api/practitioners/route";

// ── FHIR bundle factories ─────────────────────────────────────────────────────

function makePractitioner(id: string, family: string) {
  return {
    resourceType: "Practitioner",
    id,
    name: [{ family, given: ["Test"] }],
  };
}

function makePractitionerRole(practitionerId: string, orgFhirId: string) {
  return {
    resourceType: "PractitionerRole",
    practitioner: { reference: `Practitioner/${practitionerId}` },
    organization:  { reference: `Organization/${orgFhirId}` },
  };
}

function makeBundle(resources: unknown[]) {
  return {
    resourceType: "Bundle",
    total: resources.length,
    entry: resources.map((resource) => ({ resource })),
  };
}

function makeRequest(q = "") {
  const url = q
    ? `http://localhost/api/practitioners?q=${encodeURIComponent(q)}`
    : "http://localhost/api/practitioners";
  return new Request(url);
}

function makeUser(orgFhirId?: string): User {
  return {
    id:           "u-001",
    username:     "testuser",
    passwordHash: "hash",
    salt:         "salt",
    createdAt:    "2026-01-01T00:00:00Z",
    profile:      orgFhirId ? { orgFhirId } : {},
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─────────────────────────────────────────────────────────────────────────────
// Org-based filtering (user has orgFhirId)
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/practitioners — org-based filtering", () => {
  it("fetches via PractitionerRole when user has orgFhirId", async () => {
    m.getSessionFromCookies.mockResolvedValue({ sub: "u-001", username: "testuser" });
    m.getUserById.mockResolvedValue(makeUser("org-7601002145985"));

    const prac = makePractitioner("prac-001", "Müller");
    const role = makePractitionerRole("prac-001", "org-7601002145985");
    const bundle = makeBundle([role, prac]);

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(bundle),
    });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("prac-001");
    expect(body.data[0].name).toBe("Test Müller");
  });

  it("filters out practitioners not linked to the org via PractitionerRole", async () => {
    m.getSessionFromCookies.mockResolvedValue({ sub: "u-001", username: "testuser" });
    m.getUserById.mockResolvedValue(makeUser("org-7601002145985"));

    // role references only prac-001; prac-002 is in the bundle but not linked
    const prac1  = makePractitioner("prac-001", "Müller");
    const prac2  = makePractitioner("prac-002", "Schmidt");
    const role   = makePractitionerRole("prac-001", "org-7601002145985");
    const bundle = makeBundle([role, prac1, prac2]);

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve(bundle),
    });

    const res  = await GET(makeRequest());
    const body = await res.json();

    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("prac-001");
  });

  it("sends practitioner.name query param when q is provided", async () => {
    m.getSessionFromCookies.mockResolvedValue({ sub: "u-001", username: "testuser" });
    m.getUserById.mockResolvedValue(makeUser("org-7601002145985"));

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve(makeBundle([])),
    });

    await GET(makeRequest("Müller"));

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]![0]! as string;
    expect(calledUrl).toContain("practitioner.name=M%C3%BCller");
    expect(calledUrl).toContain("PractitionerRole");
    expect(calledUrl).toContain("Organization%2Forg-7601002145985");
  });

  it("returns empty data when FHIR returns an error status", async () => {
    m.getSessionFromCookies.mockResolvedValue({ sub: "u-001", username: "testuser" });
    m.getUserById.mockResolvedValue(makeUser("org-7601002145985"));

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 502 });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.data).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fallback — no org / no session
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/practitioners — fallback (all practitioners)", () => {
  it("returns all practitioners when user has no orgFhirId", async () => {
    m.getSessionFromCookies.mockResolvedValue({ sub: "u-001", username: "testuser" });
    m.getUserById.mockResolvedValue(makeUser()); // no orgFhirId

    const prac1  = makePractitioner("prac-001", "Müller");
    const prac2  = makePractitioner("prac-002", "Schmidt");
    const bundle = makeBundle([prac1, prac2]);

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve(bundle),
    });

    const res  = await GET(makeRequest());
    const body = await res.json();

    expect(body.data).toHaveLength(2);
  });

  it("returns all practitioners when no session exists", async () => {
    m.getSessionFromCookies.mockResolvedValue(null);

    const bundle = makeBundle([makePractitioner("prac-001", "Müller")]);

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve(bundle),
    });

    const res  = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
  });

  it("sends name query param to Practitioner endpoint when q is provided", async () => {
    m.getSessionFromCookies.mockResolvedValue(null);

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve(makeBundle([])),
    });

    await GET(makeRequest("Müller"));

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]![0]! as string;
    expect(calledUrl).toContain("Practitioner?");
    expect(calledUrl).toContain("name=M%C3%BCller");
  });

  it("returns empty data when FHIR returns an error in fallback path", async () => {
    m.getSessionFromCookies.mockResolvedValue(null);

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 503 });

    const res = await GET(makeRequest());
    expect(res.status).toBe(503);
    expect((await res.json()).data).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Practitioner name formatting
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/practitioners — name formatting", () => {
  it("uses text field when present", async () => {
    m.getSessionFromCookies.mockResolvedValue(null);

    const prac = { resourceType: "Practitioner", id: "p-1", name: [{ text: "Dr. Anna Bauer" }] };

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve(makeBundle([prac])),
    });

    const body = await (await GET(makeRequest())).json();
    expect(body.data[0].name).toBe("Dr. Anna Bauer");
  });

  it("constructs name from prefix + given + family when text is absent", async () => {
    m.getSessionFromCookies.mockResolvedValue(null);

    const prac = {
      resourceType: "Practitioner",
      id: "p-1",
      name: [{ prefix: ["Dr."], given: ["Anna"], family: "Bauer" }],
    };

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve(makeBundle([prac])),
    });

    const body = await (await GET(makeRequest())).json();
    expect(body.data[0].name).toBe("Dr. Anna Bauer");
  });

  it("excludes practitioners with no resolvable name", async () => {
    m.getSessionFromCookies.mockResolvedValue(null);

    const prac = { resourceType: "Practitioner", id: "p-1", name: [] };

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve(makeBundle([prac])),
    });

    const body = await (await GET(makeRequest())).json();
    expect(body.data).toHaveLength(0);
  });
});
