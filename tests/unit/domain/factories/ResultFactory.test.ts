import { ResultFactory } from "@/domain/factories/ResultFactory";
import type { Result } from "@/domain/entities/Result";

describe("ResultFactory", () => {
  describe("create()", () => {
    it("returns a Result with all defaults for empty input", () => {
      const result = ResultFactory.create({});

      expect(result.id).toBe("");
      expect(result.status).toBe("unknown");
      expect(result.codeText).toBe("");
      expect(result.category).toBe("");
      expect(result.effectiveDate).toBe("");
      expect(result.resultCount).toBe(0);
      expect(result.conclusion).toBe("");
      expect(result.basedOn).toEqual([]);
      expect(result.patientId).toBe("");
      expect(result.patientDisplay).toBe("");
      expect(result.pdfData).toBeNull();
      expect(result.pdfTitle).toBeNull();
      expect(result.hl7Data).toBeNull();
      expect(result.hl7Title).toBeNull();
    });

    it("preserves all provided valid fields", () => {
      const input: Partial<Result> = {
        id: "dr-42",
        status: "final",
        codeText: "Blutbild",
        category: "Hämatologie",
        patientId: "patient-7",
        patientDisplay: "Max Mustermann",
        resultCount: 12,
        pdfData: "base64data",
        pdfTitle: "Befund.pdf",
      };

      const result = ResultFactory.create(input);

      expect(result.id).toBe("dr-42");
      expect(result.status).toBe("final");
      expect(result.codeText).toBe("Blutbild");
      expect(result.category).toBe("Hämatologie");
      expect(result.patientId).toBe("patient-7");
      expect(result.resultCount).toBe(12);
      expect(result.pdfData).toBe("base64data");
    });

    it("maps unknown status strings to 'unknown'", () => {
      const result = ResultFactory.create({ status: "completely-invalid" as never });
      expect(result.status).toBe("unknown");
    });

    it("accepts all valid FHIR DiagnosticReport statuses", () => {
      const validStatuses = [
        "registered", "partial", "preliminary",
        "final", "amended", "corrected", "cancelled",
      ] as const;

      for (const status of validStatuses) {
        const result = ResultFactory.create({ status });
        expect(result.status).toBe(status);
      }
    });

    it("ensures basedOn is always an array", () => {
      const resultWithArray = ResultFactory.create({ basedOn: ["ServiceRequest/1"] });
      expect(resultWithArray.basedOn).toEqual(["ServiceRequest/1"]);

      const resultWithUndefined = ResultFactory.create({});
      expect(Array.isArray(resultWithUndefined.basedOn)).toBe(true);
    });

    it("treats non-numeric resultCount as 0", () => {
      const result = ResultFactory.create({ resultCount: "not-a-number" as never });
      expect(result.resultCount).toBe(0);
    });
  });

  describe("createEmpty()", () => {
    it("returns a valid Result with all defaults", () => {
      const result = ResultFactory.createEmpty();
      expect(result.status).toBe("unknown");
      expect(result.basedOn).toEqual([]);
    });

    it("accepts overrides", () => {
      const result = ResultFactory.createEmpty({ id: "test", status: "final" });
      expect(result.id).toBe("test");
      expect(result.status).toBe("final");
    });
  });
});
