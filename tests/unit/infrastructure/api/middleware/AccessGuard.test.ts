import { describe, it, expect } from "vitest";
import { resolveAccessFilter } from "@/infrastructure/api/middleware/AccessGuard";
import type { SessionUserWithOrg } from "@/lib/auth";

const base: SessionUserWithOrg = {
  sub: "usr-1",
  username: "testuser",
  role: "user",
  extraPermissions: [],
};

describe("AccessGuard.resolveAccessFilter", () => {
  describe("Level A — full access", () => {
    it("returns full for bootstrap admin (role=admin, no accessLevel)", () => {
      const result = resolveAccessFilter({ ...base, role: "admin" });
      expect(result.type).toBe("full");
    });

    it("returns full for internal FHIR user (accessLevel=full)", () => {
      const result = resolveAccessFilter({ ...base, accessLevel: "full", isInternal: true });
      expect(result.type).toBe("full");
    });

    it("returns full when isInternal=true regardless of accessLevel", () => {
      const result = resolveAccessFilter({ ...base, isInternal: true });
      expect(result.type).toBe("full");
    });
  });

  describe("Level B — org access", () => {
    it("returns org filter with allowedOrgIds from session", () => {
      const result = resolveAccessFilter({
        ...base,
        accessLevel: "org",
        allowedOrgIds: ["schulthess", "balgrist"],
      });
      expect(result.type).toBe("org");
      if (result.type === "org") {
        expect(result.orgFhirIds).toEqual(["schulthess", "balgrist"]);
      }
    });

    it("falls back to orgFhirId from profile when allowedOrgIds is empty", () => {
      const result = resolveAccessFilter({
        ...base,
        accessLevel: "org",
        allowedOrgIds: [],
        orgFhirId: "klinik-hirslanden",
      });
      expect(result.type).toBe("org");
      if (result.type === "org") {
        expect(result.orgFhirIds).toEqual(["klinik-hirslanden"]);
      }
    });

    it("denies when accessLevel=org but no org IDs at all", () => {
      const result = resolveAccessFilter({ ...base, accessLevel: "org", allowedOrgIds: [] });
      expect(result.type).toBe("deny");
    });
  });

  describe("Level C — own access", () => {
    it("returns own filter with practitionerFhirId", () => {
      const result = resolveAccessFilter({
        ...base,
        accessLevel: "own",
        practitionerFhirId: "prac-von-rohr-anna",
      });
      expect(result.type).toBe("own");
      if (result.type === "own") {
        expect(result.practitionerFhirId).toBe("prac-von-rohr-anna");
      }
    });

    it("denies when accessLevel=own but practitionerFhirId missing", () => {
      const result = resolveAccessFilter({ ...base, accessLevel: "own" });
      expect(result.type).toBe("deny");
      if (result.type === "deny") expect(result.httpStatus).toBe(403);
    });
  });

  describe("Legacy fallback (no accessLevel)", () => {
    it("falls back to org filter from profile orgFhirId", () => {
      const result = resolveAccessFilter({ ...base, orgFhirId: "spital-zollikerberg" });
      expect(result.type).toBe("org");
      if (result.type === "org") {
        expect(result.orgFhirIds).toEqual(["spital-zollikerberg"]);
      }
    });

    it("denies when no accessLevel and no orgFhirId", () => {
      const result = resolveAccessFilter({ ...base });
      expect(result.type).toBe("deny");
      if (result.type === "deny") expect(result.httpStatus).toBe(403);
    });
  });
});
