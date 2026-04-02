import { PatientsController } from "@/infrastructure/api/controllers/PatientsController";

/**
 * Integration tests for PatientsController.
 *
 * Tests cover: list mapping, name search, active/inactive filtering,
 * pagination, and error handling.
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
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
    });
  });
}

const FHIR_BASE = "http://fhir-test:8080/fhir";

describe("PatientsController.list()", () => {
  it("returns mapped patients from a successful FHIR response", async () => {
    const mockFetch = makeFetch(makeBundle([makePatient()]));
    const controller = new PatientsController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.list({ page: 1, pageSize: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe("p-001");
    expect(result.data[0].name).toBe("Hans Müller");
    expect(result.data[0].address).toBe("Hauptstrasse 1, Zürich, 8001");
    expect(result.data[0].createdAt).toBe("2024-03-01T00:00:00Z");
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.error).toBeUndefined();
  });

  it("uses name.text when present (preferred over given/family)", async () => {
    const patient = makePatient({ name: [{ text: "Prof. Dr. Hans Müller" }] });
    const mockFetch = makeFetch(makeBundle([patient]));
    const controller = new PatientsController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.list({});

    expect(result.data[0].name).toBe("Prof. Dr. Hans Müller");
  });

  it("returns 'Unknown' when name array is empty", async () => {
    const patient = makePatient({ name: [] });
    const mockFetch = makeFetch(makeBundle([patient]));
    const controller = new PatientsController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.list({});

    expect(result.data[0].name).toBe("Unknown");
  });

  it("uses address.text when present (preferred over structured fields)", async () => {
    const patient = makePatient({ address: [{ text: "Bahnhofstrasse 7, 8001 Zürich" }] });
    const mockFetch = makeFetch(makeBundle([patient]));
    const controller = new PatientsController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.list({});

    expect(result.data[0].address).toBe("Bahnhofstrasse 7, 8001 Zürich");
  });

  it("returns empty address when address array is absent", async () => {
    const patient = makePatient({ address: undefined });
    const mockFetch = makeFetch(makeBundle([patient]));
    const controller = new PatientsController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.list({});

    expect(result.data[0].address).toBe("");
  });

  it("builds FHIR URL with name filter when q is provided", async () => {
    const mockFetch = makeFetch(makeBundle([]));
    const controller = new PatientsController(FHIR_BASE, mockFetch as typeof fetch);

    await controller.list({ q: "Müller" });

    const url = (mockFetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("name=M%C3%BCller");
  });

  it("sets active=true by default (active patients)", async () => {
    const mockFetch = makeFetch(makeBundle([]));
    const controller = new PatientsController(FHIR_BASE, mockFetch as typeof fetch);

    await controller.list({});

    const url = (mockFetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("active=true");
  });

  it("sets active=false when showInactive=true", async () => {
    const mockFetch = makeFetch(makeBundle([]));
    const controller = new PatientsController(FHIR_BASE, mockFetch as typeof fetch);

    await controller.list({ showInactive: true });

    const url = (mockFetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("active=false");
  });

  it("applies correct pagination offset", async () => {
    const mockFetch = makeFetch(makeBundle([]));
    const controller = new PatientsController(FHIR_BASE, mockFetch as typeof fetch);

    await controller.list({ page: 3, pageSize: 5 });

    const url = (mockFetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("_getpagesoffset=10");
    expect(url).toContain("_count=5");
  });

  it("uses count bundle total when available", async () => {
    const mockFetch = makeFetch(
      makeBundle([makePatient()], 1),
      { resourceType: "Bundle", total: 99 },
    );
    const controller = new PatientsController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.list({});

    expect(result.total).toBe(99);
  });

  it("returns error DTO with httpStatus when FHIR returns non-200", async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    const controller = new PatientsController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.list({});

    expect(result.data).toEqual([]);
    expect(result.error).toMatch(/503/);
    expect(result.httpStatus).toBe(503);
  });

  it("returns 500 error DTO when fetch throws a network error", async () => {
    const mockFetch = jest.fn().mockRejectedValue(new Error("DNS failure"));
    const controller = new PatientsController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.list({});

    expect(result.error).toBe("DNS failure");
    expect(result.httpStatus).toBe(500);
  });

  it("filters out entries without an id", async () => {
    const bundle = makeBundle([
      makePatient({ id: "p-good" }),
      { resourceType: "Patient" }, // no id
    ]);
    const mockFetch = makeFetch(bundle);
    const controller = new PatientsController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.list({});

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe("p-good");
  });
});
