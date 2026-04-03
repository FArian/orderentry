import {
  PatientsController,
  type PatientsBundleResponse,
} from "@/infrastructure/api/controllers/PatientsController";
import type { FhirBundle } from "@/infrastructure/fhir/FhirTypes";

/**
 * Integration tests for PatientsController.
 *
 * Tests cover: FHIR Bundle pass-through, pagination URL building,
 * active/inactive filtering, org-access guard, and OperationOutcome errors.
 */

function makePatient(overrides: Record<string, unknown> = {}) {
  return {
    resourceType: "Patient",
    id: "p-001",
    name: [{ given: ["Hans"], family: "Müller" }],
    address: [{ line: ["Hauptstrasse 1"], city: "Zürich", postalCode: "8001" }],
    meta: { lastUpdated: "2024-03-01T00:00:00Z" },
    ...overrides,
  };
}

function makeBundle(resources: unknown[], total?: number) {
  return {
    resourceType: "Bundle",
    total: total ?? resources.length,
    entry: resources.map((r) => ({ resource: r })),
  };
}

function makeFetch(
  dataBundle: unknown,
  countBundle: unknown = { resourceType: "Bundle", total: 5 },
) {
  let callCount = 0;
  return jest.fn().mockImplementation(() => {
    callCount++;
    const body = callCount === 1 ? dataBundle : countBundle;
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
  });
}

const FHIR_BASE = "http://fhir-test:8080/fhir";
const ORG_QUERY = { orgFhirId: "org-test" };

function asBundle(result: PatientsBundleResponse) {
  return result as FhirBundle<{ id?: string; resourceType?: string }>;
}

describe("PatientsController.list()", () => {
  it("returns 403 OperationOutcome when no org is provided", async () => {
    const mockFetch = makeFetch(makeBundle([]));
    const controller = new PatientsController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.list({});

    expect((result as { resourceType: string }).resourceType).toBe("OperationOutcome");
    const outcome = result as { issue: Array<{ details?: { text?: string } }>; httpStatus?: number };
    expect(outcome.httpStatus).toBe(403);
    expect(outcome.issue[0]?.details?.text).toMatch(/Organisationszugang/);
  });

  it("returns FHIR Bundle with Patient entries from a successful FHIR response", async () => {
    const mockFetch = makeFetch(makeBundle([makePatient()]));
    const controller = new PatientsController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.list({ ...ORG_QUERY, page: 1, pageSize: 10 });

    const bundle = asBundle(result);
    expect(bundle.resourceType).toBe("Bundle");
    expect(bundle.entry).toHaveLength(1);
    expect(bundle.entry?.[0]?.resource?.id).toBe("p-001");
  });

  it("uses count bundle total when available", async () => {
    const mockFetch = makeFetch(
      makeBundle([makePatient()], 1),
      { resourceType: "Bundle", total: 99 },
    );
    const controller = new PatientsController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.list({ ...ORG_QUERY });

    expect(asBundle(result).total).toBe(99);
  });

  it("builds FHIR URL with name filter when q is provided", async () => {
    const mockFetch = makeFetch(makeBundle([]));
    const controller = new PatientsController(FHIR_BASE, mockFetch as typeof fetch);

    await controller.list({ ...ORG_QUERY, q: "Müller" });

    const url = (mockFetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("name=M%C3%BCller");
  });

  it("sets active=true by default (active patients)", async () => {
    const mockFetch = makeFetch(makeBundle([]));
    const controller = new PatientsController(FHIR_BASE, mockFetch as typeof fetch);

    await controller.list({ ...ORG_QUERY });

    const url = (mockFetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("active=true");
  });

  it("sets active=false when showInactive=true", async () => {
    const mockFetch = makeFetch(makeBundle([]));
    const controller = new PatientsController(FHIR_BASE, mockFetch as typeof fetch);

    await controller.list({ ...ORG_QUERY, showInactive: true });

    const url = (mockFetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("active=false");
  });

  it("applies correct pagination offset", async () => {
    const mockFetch = makeFetch(makeBundle([]));
    const controller = new PatientsController(FHIR_BASE, mockFetch as typeof fetch);

    await controller.list({ ...ORG_QUERY, page: 3, pageSize: 5 });

    const url = (mockFetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("_getpagesoffset=10");
    expect(url).toContain("_count=5");
  });

  it("returns OperationOutcome when FHIR returns non-200", async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    const controller = new PatientsController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.list({ ...ORG_QUERY });

    expect((result as { resourceType: string }).resourceType).toBe("OperationOutcome");
    const outcome = result as { issue: Array<{ details?: { text?: string } }>; httpStatus?: number };
    expect(outcome.issue[0]?.details?.text).toMatch(/503/);
    expect(outcome.httpStatus).toBe(503);
  });

  it("returns 500 OperationOutcome when fetch throws a network error", async () => {
    const mockFetch = jest.fn().mockRejectedValue(new Error("DNS failure"));
    const controller = new PatientsController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.list({ ...ORG_QUERY });

    expect((result as { resourceType: string }).resourceType).toBe("OperationOutcome");
    const outcome = result as { issue: Array<{ details?: { text?: string } }>; httpStatus?: number };
    expect(outcome.issue[0]?.details?.text).toBe("DNS failure");
    expect(outcome.httpStatus).toBe(500);
  });
});
