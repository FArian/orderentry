import type { Result } from "../entities/Result";
import { ResultStatus } from "../entities/Result";

const VALID_STATUSES: readonly ResultStatus[] = [
  ResultStatus.REGISTERED,
  ResultStatus.PARTIAL,
  ResultStatus.PRELIMINARY,
  ResultStatus.FINAL,
  ResultStatus.AMENDED,
  ResultStatus.CORRECTED,
  ResultStatus.CANCELLED,
];

/**
 * Factory — centralises Result entity creation.
 *
 * Guarantees all required fields are populated and types are valid,
 * regardless of where the raw data comes from (FHIR API, mock, test fixture…).
 *
 * Design pattern: Factory Method / Static Factory
 */
export class ResultFactory {
  /**
   * Create a Result from a partial / unknown-shape object.
   * Provides safe defaults for every required field.
   */
  static create(data: Partial<Result>): Result {
    return {
      id: data.id ?? "",
      status: ResultFactory.toStatus(data.status),
      codeText: data.codeText ?? "",
      category: data.category ?? "",
      effectiveDate: data.effectiveDate ?? "",
      resultCount: typeof data.resultCount === "number" ? data.resultCount : 0,
      conclusion: data.conclusion ?? "",
      basedOn: Array.isArray(data.basedOn) ? data.basedOn : [],
      patientId: data.patientId ?? "",
      patientDisplay: data.patientDisplay ?? "",
      pdfData: data.pdfData ?? null,
      pdfTitle: data.pdfTitle ?? null,
      hl7Data: data.hl7Data ?? null,
      hl7Title: data.hl7Title ?? null,
    };
  }

  /**
   * Convenience method for building a test fixture or placeholder.
   * Useful in unit tests and Storybook stories without touching FHIR.
   */
  static createEmpty(overrides: Partial<Result> = {}): Result {
    return ResultFactory.create(overrides);
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private static toStatus(raw: unknown): ResultStatus {
    return (VALID_STATUSES as readonly string[]).includes(String(raw ?? ""))
      ? (raw as ResultStatus)
      : ResultStatus.UNKNOWN;
  }
}
