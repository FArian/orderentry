import {
  ResultsController,
  type ResultsBundleResponse,
} from "@/infrastructure/api/controllers/ResultsController";
import type { FhirBundle } from "@/infrastructure/fhir/FhirTypes";

/**
 * Integration tests for ResultsController.
 *
 * Tests cover: FHIR Bundle pass-through, URL building (filters, pagination),
 * org-access guard, and OperationOutcome error handling.
 *
 * Field mapping (DiagnosticReport → domain Result) is tested in FhirResultRepository tests.
 */

function makeDiagnosticReport(overrides: Record<string, unknown> = {}) {
  return {
    resourceType: "DiagnosticReport",
    id: "dr-001",
    status: "final",
    subject: { reference: "Patient/p-123", display: "Müller Hans" },
    code: { text: "Blutbild" },
    effectiveDateTime: "2024-03-15T10:00:00Z",
    result: [{ reference: "Observation/obs-1" }, { reference: "Observation/obs-2" }],
    basedOn: [{ reference: "ServiceRequest/sr-001" }],
    ...overrides,
  };
}

function makeBundle(resources: unknown[], total = resources.length) {
  return {
    resourceType: "Bundle",
    total,
    entry: resources.map((r) => ({ resource: r })),
  };
}

function makeFetch(
  dataBundle: unknown,
  countBundle: unknown = { resourceType: "Bundle", total: 1 },
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

function asBundle(result: ResultsBundleResponse) {
  return result as FhirBundle<{ id?: string; status?: string; resourceType?: string }>;
}

describe("ResultsController.list()", () => {
  it("returns 403 OperationOutcome when no org is provided", async () => {
    const mockFetch = makeFetch(makeBundle([]));
    const controller = new ResultsController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.list({});

    expect((result as { resourceType: string }).resourceType).toBe("OperationOutcome");
    const outcome = result as { issue: Array<{ details?: { text?: string } }>; httpStatus?: number };
    expect(outcome.httpStatus).toBe(403);
    expect(outcome.issue[0]?.details?.text).toMatch(/Organisationszugang/);
  });

  it("returns FHIR Bundle with DiagnosticReport entries from a successful response", async () => {
    const mockFetch = makeFetch(makeBundle([makeDiagnosticReport()]));
    const controller = new ResultsController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.list({ ...ORG_QUERY, page: 1, pageSize: 20 });

    const bundle = asBundle(result);
    expect(bundle.resourceType).toBe("Bundle");
    expect(bundle.entry).toHaveLength(1);
    expect(bundle.entry?.[0]?.resource?.id).toBe("dr-001");
    expect(bundle.entry?.[0]?.resource?.status).toBe("final");
    expect(bundle.total).toBe(1);
  });

  it("uses count bundle total when available", async () => {
    const mockFetch = makeFetch(
      makeBundle([makeDiagnosticReport()], 1),
      { resourceType: "Bundle", total: 42 },
    );
    const controller = new ResultsController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.list({ ...ORG_QUERY });

    expect(asBundle(result).total).toBe(42);
  });

  it("builds the FHIR URL with patientId filter", async () => {
    const mockFetch = makeFetch(makeBundle([]));
    const controller = new ResultsController(FHIR_BASE, mockFetch as typeof fetch);

    await controller.list({ ...ORG_QUERY, patientId: "p-123" });

    const url = (mockFetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("subject=Patient%2Fp-123");
  });

  it("prefers patientId over patientName when both are provided", async () => {
    const mockFetch = makeFetch(makeBundle([]));
    const controller = new ResultsController(FHIR_BASE, mockFetch as typeof fetch);

    await controller.list({ ...ORG_QUERY, patientId: "p-123", patientName: "Müller" });

    const url = (mockFetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("subject=Patient%2Fp-123");
    expect(url).not.toContain("Patient.name");
  });

  it("builds the FHIR URL with patientName when no patientId", async () => {
    const mockFetch = makeFetch(makeBundle([]));
    const controller = new ResultsController(FHIR_BASE, mockFetch as typeof fetch);

    await controller.list({ ...ORG_QUERY, patientName: "Müller" });

    const url = (mockFetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("subject%3APatient.name=M%C3%BCller");
  });

  it("builds the FHIR URL with orderNumber filter", async () => {
    const mockFetch = makeFetch(makeBundle([]));
    const controller = new ResultsController(FHIR_BASE, mockFetch as typeof fetch);

    await controller.list({ ...ORG_QUERY, orderNumber: "ZLZ-001" });

    const url = (mockFetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("ZLZ-001");
  });

  it("applies correct page offset in FHIR URL", async () => {
    const mockFetch = makeFetch(makeBundle([]));
    const controller = new ResultsController(FHIR_BASE, mockFetch as typeof fetch);

    await controller.list({ ...ORG_QUERY, page: 3, pageSize: 10 });

    const url = (mockFetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("_getpagesoffset=20");
    expect(url).toContain("_count=10");
  });

  it("returns OperationOutcome when FHIR returns non-200", async () => {
    const failFetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    const controller = new ResultsController(FHIR_BASE, failFetch as typeof fetch);

    const result = await controller.list({ ...ORG_QUERY });

    expect((result as { resourceType: string }).resourceType).toBe("OperationOutcome");
    const outcome = result as { issue: Array<{ details?: { text?: string } }>; httpStatus?: number };
    expect(outcome.issue[0]?.details?.text).toMatch(/503/);
    expect(outcome.httpStatus).toBe(503);
  });

  it("returns 500 OperationOutcome when fetch throws a network error", async () => {
    const errorFetch = jest.fn().mockRejectedValue(new Error("Connection refused"));
    const controller = new ResultsController(FHIR_BASE, errorFetch as typeof fetch);

    const result = await controller.list({ ...ORG_QUERY });

    expect((result as { resourceType: string }).resourceType).toBe("OperationOutcome");
    const outcome = result as { issue: Array<{ details?: { text?: string } }>; httpStatus?: number };
    expect(outcome.issue[0]?.details?.text).toBe("Connection refused");
    expect(outcome.httpStatus).toBe(500);
  });
});
