import {
  PatientIdStrategy,
  PatientNameStrategy,
  PatientSearchStrategySelector,
} from "@/application/strategies/PatientSearchStrategy";

describe("PatientIdStrategy", () => {
  const strategy = new PatientIdStrategy();

  describe("matches()", () => {
    it("matches pure-digit strings with 5+ characters (numeric patient ID)", () => {
      expect(strategy.matches("12345")).toBe(true);
      expect(strategy.matches("987654321")).toBe(true);
    });

    it("matches UUID strings", () => {
      expect(strategy.matches("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    });

    it("does not match short digit strings (< 5 digits)", () => {
      expect(strategy.matches("1234")).toBe(false);
    });

    it("does not match alphabetic strings", () => {
      expect(strategy.matches("Müller Hans")).toBe(false);
    });

    it("does not match mixed alphanumeric (non-UUID) strings", () => {
      expect(strategy.matches("ABC123")).toBe(false);
    });
  });

  describe("buildParams()", () => {
    it("returns patientId param", () => {
      const params = strategy.buildParams("12345");
      expect(params).toEqual({ patientId: "12345" });
      expect(params.patientName).toBeUndefined();
    });

    it("trims the input", () => {
      const params = strategy.buildParams("  12345  ");
      expect(params.patientId).toBe("12345");
    });
  });
});

describe("PatientNameStrategy", () => {
  const strategy = new PatientNameStrategy();

  describe("matches()", () => {
    it("always returns true (fallback strategy)", () => {
      expect(strategy.matches("anything")).toBe(true);
      expect(strategy.matches("")).toBe(true);
    });
  });

  describe("buildParams()", () => {
    it("returns patientName param for non-empty input", () => {
      const params = strategy.buildParams("Müller");
      expect(params).toEqual({ patientName: "Müller" });
    });

    it("returns undefined patientName for empty input", () => {
      const params = strategy.buildParams("  ");
      expect(params.patientName).toBeUndefined();
    });
  });
});

describe("PatientSearchStrategySelector", () => {
  const selector = new PatientSearchStrategySelector();

  describe("select()", () => {
    it("selects PatientIdStrategy for numeric IDs", () => {
      const strategy = selector.select("12345");
      expect(strategy).toBeInstanceOf(PatientIdStrategy);
    });

    it("selects PatientNameStrategy for text names", () => {
      const strategy = selector.select("Müller Hans");
      expect(strategy).toBeInstanceOf(PatientNameStrategy);
    });
  });

  describe("resolve()", () => {
    it("resolves a numeric ID to patientId param", () => {
      const params = selector.resolve("12345");
      expect(params.patientId).toBe("12345");
      expect(params.patientName).toBeUndefined();
    });

    it("resolves a name to patientName param", () => {
      const params = selector.resolve("Müller Hans");
      expect(params.patientName).toBe("Müller Hans");
      expect(params.patientId).toBeUndefined();
    });

    it("resolves a UUID to patientId param", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const params = selector.resolve(uuid);
      expect(params.patientId).toBe(uuid);
    });

    it("resolves an empty string to undefined patientName", () => {
      const params = selector.resolve("");
      expect(params.patientName).toBeUndefined();
      expect(params.patientId).toBeUndefined();
    });
  });
});
