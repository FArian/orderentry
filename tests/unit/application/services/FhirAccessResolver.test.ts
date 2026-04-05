import { describe, it, expect, vi } from "vitest";
import { FhirAccessResolver } from "@/application/services/FhirAccessResolver";

const BASE_URL = "http://fhir-test";
const INTERNAL_ORGS = ["zlz", "zetlab", "zlz-notfall"];

function makeBundle(roles: object[]) {
  return JSON.stringify({
    resourceType: "Bundle",
    entry: roles.map((r) => ({ resource: r })),
  });
}

function makeFetch(body: string, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => JSON.parse(body),
  });
}

describe("FhirAccessResolver", () => {
  describe("Rule 0 — DB admin always FULL", () => {
    it("returns full for admin with no practitionerFhirId", async () => {
      const resolver = new FhirAccessResolver({ fhirBaseUrl: BASE_URL, internalOrgIds: INTERNAL_ORGS });
      const result = await resolver.resolve(undefined, "admin");
      expect(result.level).toBe("full");
      expect(result.isInternal).toBe(true);
    });

    it("returns full for admin with practitionerFhirId set (no FHIR lookup)", async () => {
      // fetchFn must NOT be called — admin bypasses FHIR
      const fetchFn = vi.fn();
      const resolver = new FhirAccessResolver({ fhirBaseUrl: BASE_URL, internalOrgIds: INTERNAL_ORGS, fetchFn });
      const result = await resolver.resolve("prac-farhad", "admin");
      expect(result.level).toBe("full");
      expect(result.isInternal).toBe(true);
      expect(result.practitionerFhirId).toBe("prac-farhad");
      expect(fetchFn).not.toHaveBeenCalled();
    });
  });

  describe("Rule 1 — FHIR unavailable", () => {
    it("throws when FHIR is unreachable and practitionerFhirId is set", async () => {
      const fetchFn = vi.fn().mockRejectedValue(new Error("network error"));
      const resolver = new FhirAccessResolver({ fhirBaseUrl: BASE_URL, internalOrgIds: INTERNAL_ORGS, fetchFn });
      await expect(resolver.resolve("prac-test", "user")).rejects.toThrow("FHIR-Server nicht erreichbar");
    });
  });

  describe("Rule 2 — internal org", () => {
    it("returns full for practitioner with role in ZLZ", async () => {
      const bundle = makeBundle([{
        resourceType: "PractitionerRole",
        active: true,
        practitioner: { reference: "Practitioner/prac-dede" },
        organization: { reference: "Organization/zlz" },
        code: [{ coding: [{ system: "http://snomed.info/sct", code: "159418007" }] }],
      }]);
      const resolver = new FhirAccessResolver({ fhirBaseUrl: BASE_URL, internalOrgIds: INTERNAL_ORGS, fetchFn: makeFetch(bundle) });
      const result = await resolver.resolve("prac-dede", "user");
      expect(result.level).toBe("full");
      expect(result.isInternal).toBe(true);
    });
  });

  describe("Rule 3 — org-admin", () => {
    it("returns org level for practitioner with org-admin code (224608005)", async () => {
      const bundle = makeBundle([{
        resourceType: "PractitionerRole",
        active: true,
        practitioner: { reference: "Practitioner/prac-admin" },
        organization: { reference: "Organization/klinik-hirslanden" },
        code: [{ coding: [{ system: "http://snomed.info/sct", code: "224608005" }] }],
      }]);
      const resolver = new FhirAccessResolver({ fhirBaseUrl: BASE_URL, internalOrgIds: INTERNAL_ORGS, fetchFn: makeFetch(bundle) });
      const result = await resolver.resolve("prac-admin", "user");
      expect(result.level).toBe("org");
      expect(result.allowedOrgIds).toContain("klinik-hirslanden");
    });
  });

  describe("Rule 4 — external physician", () => {
    it("returns own level for physician with 309343006", async () => {
      const bundle = makeBundle([{
        resourceType: "PractitionerRole",
        active: true,
        practitioner: { reference: "Practitioner/prac-von-rohr" },
        organization: { reference: "Organization/schulthess-klinik" },
        code: [{ coding: [{ system: "http://snomed.info/sct", code: "309343006" }] }],
      }]);
      const resolver = new FhirAccessResolver({ fhirBaseUrl: BASE_URL, internalOrgIds: INTERNAL_ORGS, fetchFn: makeFetch(bundle) });
      const result = await resolver.resolve("prac-von-rohr", "user");
      expect(result.level).toBe("own");
      expect(result.practitionerFhirId).toBe("prac-von-rohr");
    });

    it("collects all org IDs from multiple PractitionerRoles", async () => {
      const bundle = makeBundle([
        { resourceType: "PractitionerRole", active: true, organization: { reference: "Organization/schulthess-klinik" }, code: [{ coding: [{ code: "309343006" }] }] },
        { resourceType: "PractitionerRole", active: true, organization: { reference: "Organization/balgrist" }, code: [{ coding: [{ code: "309343006" }] }] },
        { resourceType: "PractitionerRole", active: true, organization: { reference: "Organization/4i-praxis" }, code: [{ coding: [{ code: "309343006" }] }] },
      ]);
      const resolver = new FhirAccessResolver({ fhirBaseUrl: BASE_URL, internalOrgIds: INTERNAL_ORGS, fetchFn: makeFetch(bundle) });
      const result = await resolver.resolve("prac-von-rohr", "user");
      expect(result.level).toBe("own");
      expect(result.allowedOrgIds).toHaveLength(3);
    });
  });

  describe("Rule 5 — no valid role", () => {
    it("throws when no PractitionerRoles found", async () => {
      const bundle = makeBundle([]);
      const resolver = new FhirAccessResolver({ fhirBaseUrl: BASE_URL, internalOrgIds: INTERNAL_ORGS, fetchFn: makeFetch(bundle) });
      await expect(resolver.resolve("prac-unknown", "user")).rejects.toThrow("Keine aktive PractitionerRole");
    });

    it("throws when no practitionerFhirId and role is not admin", async () => {
      const resolver = new FhirAccessResolver({ fhirBaseUrl: BASE_URL, internalOrgIds: INTERNAL_ORGS });
      await expect(resolver.resolve(undefined, "user")).rejects.toThrow("Kein FHIR-Practitioner");
    });
  });
});
