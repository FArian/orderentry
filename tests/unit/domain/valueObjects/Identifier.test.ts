import { Identifier } from "@/domain/valueObjects/Identifier";

describe("Identifier value object", () => {
  const SYSTEM = "http://zetlab.ch/fhir/sid/order-numbers";

  describe("constructor", () => {
    it("creates a valid Identifier", () => {
      const id = new Identifier(SYSTEM, "ZLZ-001");
      expect(id.system).toBe(SYSTEM);
      expect(id.value).toBe("ZLZ-001");
    });

    it("throws when value is empty", () => {
      expect(() => new Identifier(SYSTEM, "")).toThrow();
    });

    it("throws when value is whitespace-only", () => {
      expect(() => new Identifier(SYSTEM, "   ")).toThrow();
    });

    it("allows empty system (system is optional in FHIR)", () => {
      const id = new Identifier("", "some-value");
      expect(id.system).toBe("");
    });
  });

  describe("toToken()", () => {
    it("formats as 'system|value' FHIR token", () => {
      const id = new Identifier(SYSTEM, "ZLZ-001");
      expect(id.toToken()).toBe(`${SYSTEM}|ZLZ-001`);
    });
  });

  describe("equals()", () => {
    it("returns true for same system and value", () => {
      const a = new Identifier(SYSTEM, "ZLZ-001");
      const b = new Identifier(SYSTEM, "ZLZ-001");
      expect(a.equals(b)).toBe(true);
    });

    it("returns false for different system", () => {
      const a = new Identifier("http://system-a", "val");
      const b = new Identifier("http://system-b", "val");
      expect(a.equals(b)).toBe(false);
    });

    it("returns false for different value", () => {
      const a = new Identifier(SYSTEM, "ZLZ-001");
      const b = new Identifier(SYSTEM, "ZLZ-002");
      expect(a.equals(b)).toBe(false);
    });
  });

  describe("toString()", () => {
    it("returns the token format", () => {
      const id = new Identifier(SYSTEM, "ZLZ-001");
      expect(id.toString()).toBe(`${SYSTEM}|ZLZ-001`);
    });
  });
});
