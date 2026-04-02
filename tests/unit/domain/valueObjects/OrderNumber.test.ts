import { OrderNumber } from "@/domain/valueObjects/OrderNumber";

describe("OrderNumber value object", () => {
  describe("constructor", () => {
    it("creates an OrderNumber from a valid string", () => {
      const on = new OrderNumber("ZLZ-2024-001");
      expect(on.value).toBe("ZLZ-2024-001");
    });

    it("trims whitespace", () => {
      const on = new OrderNumber("  ZLZ-2024-001  ");
      expect(on.value).toBe("ZLZ-2024-001");
    });

    it("throws for empty string", () => {
      expect(() => new OrderNumber("")).toThrow("OrderNumber cannot be empty");
    });

    it("throws for whitespace-only string", () => {
      expect(() => new OrderNumber("   ")).toThrow("OrderNumber cannot be empty");
    });
  });

  describe("equals()", () => {
    it("returns true for identical values", () => {
      const a = new OrderNumber("ZLZ-001");
      const b = new OrderNumber("ZLZ-001");
      expect(a.equals(b)).toBe(true);
    });

    it("returns false for different values", () => {
      const a = new OrderNumber("ZLZ-001");
      const b = new OrderNumber("ZLZ-002");
      expect(a.equals(b)).toBe(false);
    });
  });

  describe("toString()", () => {
    it("returns the string value", () => {
      const on = new OrderNumber("ZLZ-2024-001");
      expect(on.toString()).toBe("ZLZ-2024-001");
      expect(String(on)).toBe("ZLZ-2024-001");
    });
  });
});
