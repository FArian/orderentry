import {
  OrdersController,
  type OrdersBundleResponse,
} from "@/infrastructure/api/controllers/OrdersController";
import type { FhirBundle } from "@/infrastructure/fhir/FhirTypes";

/**
 * Integration tests for OrdersController.
 *
 * Tests cover: list (FHIR Bundle), hard delete, soft-delete fallback (409),
 * and error handling for both operations.
 */

function makeServiceRequest(overrides: Record<string, unknown> = {}) {
  return {
    resourceType: "ServiceRequest",
    id: "sr-001",
    status: "active",
    intent: "order",
    code: { text: "Grosses Blutbild" },
    authoredOn: "2024-03-15T09:00:00Z",
    identifier: [
      {
        system: "http://localhost:8080/fhir/order-numbers",
        value: "ZLZ-2024-001",
      },
    ],
    specimen: [{ reference: "Specimen/sp-001" }],
    subject: { reference: "Patient/p-123" },
    ...overrides,
  };
}

function makeBundle(resources: unknown[]) {
  return {
    resourceType: "Bundle",
    total: resources.length,
    entry: resources.map((r) => ({ resource: r })),
  };
}

const FHIR_BASE = "http://fhir-test:8080/fhir";
const ORG_QUERY = { orgFhirId: "org-test" };

function asBundle(result: OrdersBundleResponse) {
  return result as FhirBundle<{ id?: string; status?: string; code?: { text?: string }; identifier?: Array<{ system?: string; value?: string }>; specimen?: unknown[]; subject?: { reference?: string } }>;
}

describe("OrdersController.list()", () => {
  it("returns FHIR Bundle with ServiceRequests from a successful FHIR response", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(makeBundle([makeServiceRequest()])),
    });
    const controller = new OrdersController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.list(ORG_QUERY);

    const bundle = asBundle(result);
    expect(bundle.entry).toHaveLength(1);
    expect(bundle.entry?.[0]?.resource?.id).toBe("sr-001");
    expect(bundle.entry?.[0]?.resource?.status).toBe("active");
    expect(bundle.entry?.[0]?.resource?.code?.text).toBe("Grosses Blutbild");
    expect(bundle.total).toBe(1);
    expect(bundle.resourceType).toBe("Bundle");
  });

  it("returns OperationOutcome when FHIR list fails", async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: false, status: 502 });
    const controller = new OrdersController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.list(ORG_QUERY);

    expect((result as { resourceType: string }).resourceType).toBe("OperationOutcome");
    const outcome = result as { issue: Array<{ details?: { text?: string } }>; httpStatus?: number };
    expect(outcome.issue[0]?.details?.text).toMatch(/502/);
    expect(outcome.httpStatus).toBe(502);
  });

  it("returns 500 OperationOutcome when fetch throws", async () => {
    const mockFetch = jest.fn().mockRejectedValue(new Error("Timeout"));
    const controller = new OrdersController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.list(ORG_QUERY);

    expect((result as { resourceType: string }).resourceType).toBe("OperationOutcome");
    const outcome = result as { issue: Array<{ details?: { text?: string } }>; httpStatus?: number };
    expect(outcome.issue[0]?.details?.text).toBe("Timeout");
    expect(outcome.httpStatus).toBe(500);
  });

  it("falls back to entry count when bundle.total is absent", async () => {
    const bundle = { resourceType: "Bundle", entry: [{ resource: makeServiceRequest() }] };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(bundle),
    });
    const controller = new OrdersController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.list(ORG_QUERY);

    expect(asBundle(result).total).toBeUndefined(); // no total in source bundle
    expect(asBundle(result).entry).toHaveLength(1);
  });
});

describe("OrdersController.delete()", () => {
  it("returns deleted=true on successful hard DELETE (200)", async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    const controller = new OrdersController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.delete("sr-001");

    expect(result.deleted).toBe(true);
    expect(result.soft).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  it("returns deleted=true on hard DELETE with 204 No Content", async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: false, status: 204 });
    const controller = new OrdersController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.delete("sr-001");

    expect(result.deleted).toBe(true);
  });

  it("performs soft-delete when hard DELETE returns 409", async () => {
    let callIndex = 0;
    const sr = makeServiceRequest({ status: "active" });
    const mockFetch = jest.fn().mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        // Hard DELETE → 409
        return Promise.resolve({ ok: false, status: 409 });
      }
      if (callIndex === 2) {
        // GET current resource
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(sr),
        });
      }
      // PUT updated resource (entered-in-error)
      return Promise.resolve({ ok: true, status: 200 });
    });
    const controller = new OrdersController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.delete("sr-001");

    expect(result.deleted).toBe(true);
    expect(result.soft).toBe(true);

    // Verify the PUT body set status to entered-in-error
    const putCall = (mockFetch as jest.Mock).mock.calls[2];
    const putBody = JSON.parse(putCall[1].body as string) as Record<string, unknown>;
    expect(putBody.status).toBe("entered-in-error");
  });

  it("returns error DTO when soft-delete GET fails", async () => {
    let callIndex = 0;
    const mockFetch = jest.fn().mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) return Promise.resolve({ ok: false, status: 409 });
      return Promise.resolve({ ok: false, status: 404 });
    });
    const controller = new OrdersController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.delete("sr-001");

    expect(result.deleted).toBe(false);
    expect(result.error).toMatch(/404/);
  });

  it("returns error DTO on non-404/non-409 FHIR errors", async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    const controller = new OrdersController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.delete("sr-001");

    expect(result.deleted).toBe(false);
    expect(result.error).toMatch(/500/);
    expect(result.httpStatus).toBe(500);
  });

  it("returns 500 error DTO when fetch throws during delete", async () => {
    const mockFetch = jest.fn().mockRejectedValue(new Error("Network down"));
    const controller = new OrdersController(FHIR_BASE, mockFetch as typeof fetch);

    const result = await controller.delete("sr-001");

    expect(result.deleted).toBe(false);
    expect(result.error).toBe("Network down");
    expect(result.httpStatus).toBe(500);
  });
});
