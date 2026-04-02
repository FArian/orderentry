import { ResultsController } from "@/infrastructure/api/controllers/ResultsController";

/**
 * Integration tests for ResultsController.
 *
 * The controller is constructed with an injected fetch mock so no real
 * FHIR server is needed. These tests verify the full controller logic:
 * URL building, response mapping, error handling, and pagination.
 */

// ── FHIR fixture helpers ──────────────────────────────────────────────────────
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
  status = 200,
) {
  let callCount = 0;
  return jest.fn().mockImplementation(() => {
    callCount++;
    const body = callCount === 1 ? dataBundle : countBundle;
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    });
  });
}
// ─────────────────────────────────────────────────────────────────────────────

describe("ResultsController.list()", () => {
  const FHIR_BASE = "http://fhir-test:8080/fhir";

  it("returns mapped results from a successful FHIR response", async () => {
    const mockFetch = makeFetch(makeBundle([makeDiagnosticReport()]));
    const controller = new ResultsController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.list({ page: 1, pageSize: 20 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.id).toBe("dr-001");
    expect(result.data[0]!.status).toBe("final");
    expect(result.data[0]!.codeText).toBe("Blutbild");
    expect(result.data[0]!.patientId).toBe("p-123");
    expect(result.data[0]!.patientDisplay).toBe("Müller Hans");
    expect(result.data[0]!.resultCount).toBe(2);
    expect(result.data[0]!.basedOn).toEqual(["ServiceRequest/sr-001"]);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.error).toBeUndefined();
  });

  it("builds the FHIR URL with patientId filter", async () => {
    const mockFetch = makeFetch(makeBundle([]));
    const controller = new ResultsController(FHIR_BASE, mockFetch as typeof fetch);

    await controller.list({ patientId: "p-123" });

    const [firstCall] = (mockFetch as jest.Mock).mock.calls;
    const url = firstCall[0] as string;
    expect(url).toContain("subject=Patient%2Fp-123");
  });

  it("prefers patientId over patientName when both are provided", async () => {
    const mockFetch = makeFetch(makeBundle([]));
    const controller = new ResultsController(FHIR_BASE, mockFetch as typeof fetch);

    await controller.list({ patientId: "p-123", patientName: "Müller" });

    const url = (mockFetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("subject=Patient%2Fp-123");
    expect(url).not.toContain("Patient.name");
  });

  it("builds the FHIR URL with patientName when no patientId", async () => {
    const mockFetch = makeFetch(makeBundle([]));
    const controller = new ResultsController(FHIR_BASE, mockFetch as typeof fetch);

    await controller.list({ patientName: "Müller" });

    const url = (mockFetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("subject%3APatient.name=M%C3%BCller");
  });

  it("builds the FHIR URL with orderNumber filter", async () => {
    const mockFetch = makeFetch(makeBundle([]));
    const controller = new ResultsController(FHIR_BASE, mockFetch as typeof fetch);

    await controller.list({ orderNumber: "ZLZ-001" });

    const url = (mockFetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("ZLZ-001");
  });

  it("applies correct page offset in FHIR URL", async () => {
    const mockFetch = makeFetch(makeBundle([]));
    const controller = new ResultsController(FHIR_BASE, mockFetch as typeof fetch);

    await controller.list({ page: 3, pageSize: 10 });

    const url = (mockFetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("_getpagesoffset=20");
    expect(url).toContain("_count=10");
  });

  it("extracts pdfData and hl7Data from presentedForm", async () => {
    const dr = makeDiagnosticReport({
      presentedForm: [
        { contentType: "application/pdf", data: "base64pdf==", title: "Befund.pdf" },
        { contentType: "text/hl7v2+er7", data: "base64hl7==", title: "ORU.hl7" },
      ],
    });
    const mockFetch = makeFetch(makeBundle([dr]));
    const controller = new ResultsController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.list({});

    expect(result.data[0]!.pdfData).toBe("base64pdf==");
    expect(result.data[0]!.pdfTitle).toBe("Befund.pdf");
    expect(result.data[0]!.hl7Data).toBe("base64hl7==");
    expect(result.data[0]!.hl7Title).toBe("ORU.hl7");
  });

  it("returns error DTO with httpStatus when FHIR returns non-200", async () => {
    const failFetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    const controller = new ResultsController(FHIR_BASE, failFetch as typeof fetch);

    const result = await controller.list({});

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.error).toMatch(/503/);
    expect(result.httpStatus).toBe(503);
  });

  it("returns 500 error DTO when fetch throws a network error", async () => {
    const errorFetch = jest.fn().mockRejectedValue(new Error("Connection refused"));
    const controller = new ResultsController(FHIR_BASE, errorFetch as typeof fetch);

    const result = await controller.list({});

    expect(result.error).toBe("Connection refused");
    expect(result.httpStatus).toBe(500);
  });

  it("filters out entries without an id", async () => {
    const bundle = makeBundle([
      makeDiagnosticReport({ id: "dr-good" }),
      { resourceType: "DiagnosticReport" }, // no id — should be filtered
    ]);
    const mockFetch = makeFetch(bundle, { resourceType: "Bundle", total: 2 });
    const controller = new ResultsController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.list({});

    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.id).toBe("dr-good");
  });

  it("uses count bundle total when available", async () => {
    const mockFetch = makeFetch(
      makeBundle([makeDiagnosticReport()], 1),
      { resourceType: "Bundle", total: 42 },
    );
    const controller = new ResultsController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.list({});

    expect(result.total).toBe(42);
  });
});
