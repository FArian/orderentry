import type { Result } from "@/domain/entities/Result";
import { ResultStatus } from "@/domain/entities/Result";

// Minimal FHIR types scoped to this mapper — no shared FHIR lib dependency.
interface FhirCoding { system?: string; code?: string; display?: string }
interface FhirCodeableConcept { text?: string; coding?: FhirCoding[] }
interface FhirAttachment { contentType?: string; data?: string; title?: string }

export interface FhirDiagnosticReport {
  resourceType: "DiagnosticReport";
  id?: string;
  status?: string;
  category?: FhirCodeableConcept[];
  code?: FhirCodeableConcept;
  subject?: { reference?: string; display?: string };
  effectiveDateTime?: string;
  issued?: string;
  basedOn?: Array<{ reference?: string }>;
  result?: Array<{ reference?: string; display?: string }>;
  conclusion?: string;
  presentedForm?: FhirAttachment[];
  meta?: { lastUpdated?: string };
}

/** Maps a FHIR DiagnosticReport status string to the domain ResultStatus enum. */
function toStatus(raw?: string): ResultStatus {
  switch (raw) {
    case "registered":  return ResultStatus.REGISTERED;
    case "partial":     return ResultStatus.PARTIAL;
    case "preliminary": return ResultStatus.PRELIMINARY;
    case "final":       return ResultStatus.FINAL;
    case "amended":     return ResultStatus.AMENDED;
    case "corrected":   return ResultStatus.CORRECTED;
    case "cancelled":   return ResultStatus.CANCELLED;
    default:            return ResultStatus.UNKNOWN;
  }
}

function extractPatientId(subject?: { reference?: string }): string {
  const ref = subject?.reference ?? "";
  return ref.startsWith("Patient/") ? ref.slice("Patient/".length) : ref;
}

/**
 * Maps a FHIR DiagnosticReport resource to the domain Result entity.
 */
export class DiagnosticReportMapper {
  static toDomain(fhir: FhirDiagnosticReport): Result {
    const forms = fhir.presentedForm ?? [];
    const pdf = forms.find((f) => (f.contentType ?? "").toLowerCase().includes("pdf"));
    const hl7 = forms.find((f) => (f.contentType ?? "").toLowerCase().includes("hl7"));

    return {
      id: fhir.id ?? "",
      status: toStatus(fhir.status),
      codeText: fhir.code?.text ?? fhir.code?.coding?.[0]?.display ?? "",
      category:
        fhir.category?.[0]?.text ??
        fhir.category?.[0]?.coding?.[0]?.display ??
        "",
      effectiveDate:
        fhir.effectiveDateTime ?? fhir.issued ?? fhir.meta?.lastUpdated ?? "",
      resultCount: Array.isArray(fhir.result) ? fhir.result.length : 0,
      conclusion: fhir.conclusion ?? "",
      basedOn: (fhir.basedOn ?? [])
        .map((r) => r.reference ?? "")
        .filter(Boolean),
      patientId: extractPatientId(fhir.subject),
      patientDisplay: fhir.subject?.display ?? "",
      pdfData: pdf?.data ?? null,
      pdfTitle: pdf?.title ?? null,
      hl7Data: hl7?.data ?? null,
      hl7Title: hl7?.title ?? null,
    };
  }
}
