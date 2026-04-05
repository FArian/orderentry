import { describe, it, expect } from "vitest";
import { GlnAdapterV1 }         from "@/application/adapters/GlnAdapterV1";
import { GlnAdapterV2 }         from "@/application/adapters/GlnAdapterV2";
import type { GlnLookupResult } from "@/domain/entities/GlnLookupResult";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NAT_RESULT: GlnLookupResult = {
  gln:          "7601000123456",
  ptype:        "NAT",
  roleType:     "HPC",
  organization: "",
  lastName:     "Müller",
  firstName:    "Hans",
  street:       "Bahnhofstrasse",
  streetNo:     "1",
  zip:          "8001",
  city:         "Zürich",
  canton:       "ZH",
  country:      "CH",
};

const JUR_RESULT: GlnLookupResult = {
  gln:          "7601001234567",
  ptype:        "JUR",
  roleType:     "ORG",
  organization: "Hirslanden AG",
  lastName:     "",
  firstName:    "",
  street:       "Witellikerstrasse",
  streetNo:     "40",
  zip:          "8032",
  city:         "Zürich",
  canton:       "ZH",
  country:      "CH",
};

// ── GlnAdapterV1 ─────────────────────────────────────────────────────────────

describe("GlnAdapterV1", () => {
  const adapter = new GlnAdapterV1();

  describe("NAT partner", () => {
    const result = adapter.adapt(NAT_RESULT);

    it("preserves gln", () => expect(result.gln).toBe("7601000123456"));
    it("maps ptype correctly", () => expect(result.ptype).toBe("NAT"));
    it("maps roleType correctly", () => expect(result.roleType).toBe("HPC"));
    it("lastName is set", () => expect(result.lastName).toBe("Müller"));
    it("firstName is set", () => expect(result.firstName).toBe("Hans"));
    it("organization is empty string for NAT", () => expect(result.organization).toBe(""));
    it("address fields are at top level", () => {
      expect(result.street).toBe("Bahnhofstrasse");
      expect(result.zip).toBe("8001");
      expect(result.canton).toBe("ZH");
    });
  });

  describe("JUR partner", () => {
    const result = adapter.adapt(JUR_RESULT);

    it("maps ptype correctly", () => expect(result.ptype).toBe("JUR"));
    it("organization is set", () => expect(result.organization).toBe("Hirslanden AG"));
    it("lastName is empty for JUR", () => expect(result.lastName).toBe(""));
    it("firstName is empty for JUR", () => expect(result.firstName).toBe(""));
  });
});

// ── GlnAdapterV2 ─────────────────────────────────────────────────────────────

describe("GlnAdapterV2", () => {
  const adapter = new GlnAdapterV2();

  describe("NAT partner", () => {
    const result = adapter.adapt(NAT_RESULT);

    it("preserves gln", () => expect(result.gln).toBe("7601000123456"));
    it("renames ptype → partnerType", () => expect(result.partnerType).toBe("NAT"));
    it("renames roleType → role", () => expect(result.role).toBe("HPC"));
    it("computes displayName as 'Müller Hans'", () => expect(result.displayName).toBe("Müller Hans"));
    it("person object is populated for NAT", () => {
      expect(result.person).not.toBeNull();
      expect(result.person?.lastName).toBe("Müller");
      expect(result.person?.firstName).toBe("Hans");
    });
    it("organization is null for NAT", () => expect(result.organization).toBeNull());
    it("address is nested object", () => {
      expect(result.address.street).toBe("Bahnhofstrasse");
      expect(result.address.zip).toBe("8001");
      expect(result.address.canton).toBe("ZH");
    });
    it("no flat address fields at top level", () => {
      const raw = result as unknown as Record<string, unknown>;
      expect(raw["street"]).toBeUndefined();
      expect(raw["zip"]).toBeUndefined();
    });
  });

  describe("JUR partner", () => {
    const result = adapter.adapt(JUR_RESULT);

    it("renames ptype → partnerType", () => expect(result.partnerType).toBe("JUR"));
    it("computes displayName as organisation name", () => expect(result.displayName).toBe("Hirslanden AG"));
    it("person is null for JUR", () => expect(result.person).toBeNull());
    it("organization is set for JUR", () => expect(result.organization).toBe("Hirslanden AG"));
  });

  describe("v2 → v1 compatibility check", () => {
    const v1 = new GlnAdapterV1().adapt(NAT_RESULT);
    const v2 = new GlnAdapterV2().adapt(NAT_RESULT);

    it("v1 has ptype field, v2 does not", () => {
      expect(v1.ptype).toBeDefined();
      expect((v2 as unknown as Record<string, unknown>)["ptype"]).toBeUndefined();
    });
    it("v2 has partnerType field, v1 does not", () => {
      expect(v2.partnerType).toBeDefined();
      expect((v1 as unknown as Record<string, unknown>)["partnerType"]).toBeUndefined();
    });
    it("both carry the same GLN", () => {
      expect(v1.gln).toBe(v2.gln);
    });
  });
});
