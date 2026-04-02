import {
  DiagnosticReportMapper,
  type FhirDiagnosticReport,
} from "@/infrastructure/fhir/DiagnosticReportMapper";

/**
 * Integration tests for the DiagnosticReport → domain Result mapping.
 *
 * These tests use real FHIR-shaped objects (no mock) to verify that the
 * adapter (DiagnosticReportMapper) correctly converts FHIR payloads into
 * domain entities.
 */
describe("DiagnosticReportMapper.toDomain()", () => {
  const minimalFhir: FhirDiagnosticReport = {
    resourceType: "DiagnosticReport",
    id: "dr-123",
    status: "final",
    subject: { reference: "Patient/p-456", display: "Müller Hans" },
    code: { text: "Blutbild", coding: [{ display: "Complete Blood Count" }] },
  };

  it("maps id, status, codeText from a minimal FHIR resource", () => {
    const result = DiagnosticReportMapper.toDomain(minimalFhir);

    expect(result.id).toBe("dr-123");
    expect(result.status).toBe("final");
    expect(result.codeText).toBe("Blutbild");
  });

  it("extracts patientId from subject reference", () => {
    const result = DiagnosticReportMapper.toDomain(minimalFhir);
    expect(result.patientId).toBe("p-456");
    expect(result.patientDisplay).toBe("Müller Hans");
  });

  it("falls back to coding.display when code.text is missing", () => {
    const fhir: FhirDiagnosticReport = {
      ...minimalFhir,
      code: { coding: [{ display: "Complete Blood Count" }] },
    };
    const result = DiagnosticReportMapper.toDomain(fhir);
    expect(result.codeText).toBe("Complete Blood Count");
  });

  it("maps category from text or first coding", () => {
    const fhir: FhirDiagnosticReport = {
      ...minimalFhir,
      category: [{ text: "Hämatologie" }],
    };
    const result = DiagnosticReportMapper.toDomain(fhir);
    expect(result.category).toBe("Hämatologie");
  });

  it("counts result references correctly", () => {
    const fhir: FhirDiagnosticReport = {
      ...minimalFhir,
      result: [
        { reference: "Observation/obs-1" },
        { reference: "Observation/obs-2" },
        { reference: "Observation/obs-3" },
      ],
    };
    const result = DiagnosticReportMapper.toDomain(fhir);
    expect(result.resultCount).toBe(3);
  });

  it("extracts all basedOn references", () => {
    const fhir: FhirDiagnosticReport = {
      ...minimalFhir,
      basedOn: [
        { reference: "ServiceRequest/sr-1" },
        { reference: "ServiceRequest/sr-2" },
      ],
    };
    const result = DiagnosticReportMapper.toDomain(fhir);
    expect(result.basedOn).toEqual([
      "ServiceRequest/sr-1",
      "ServiceRequest/sr-2",
    ]);
  });

  it("extracts PDF attachment (base64 data + title)", () => {
    const fhir: FhirDiagnosticReport = {
      ...minimalFhir,
      presentedForm: [
        { contentType: "application/pdf", data: "base64pdfdata==", title: "Befund.pdf" },
      ],
    };
    const result = DiagnosticReportMapper.toDomain(fhir);
    expect(result.pdfData).toBe("base64pdfdata==");
    expect(result.pdfTitle).toBe("Befund.pdf");
    expect(result.hl7Data).toBeNull();
  });

  it("extracts HL7 attachment", () => {
    const fhir: FhirDiagnosticReport = {
      ...minimalFhir,
      presentedForm: [
        { contentType: "text/hl7v2+er7", data: "base64hl7data==", title: "ORU.hl7" },
      ],
    };
    const result = DiagnosticReportMapper.toDomain(fhir);
    expect(result.hl7Data).toBe("base64hl7data==");
    expect(result.pdfData).toBeNull();
  });

  it("extracts both PDF and HL7 when both are present", () => {
    const fhir: FhirDiagnosticReport = {
      ...minimalFhir,
      presentedForm: [
        { contentType: "application/pdf", data: "pdfdata==", title: "Report.pdf" },
        { contentType: "text/hl7v2+er7", data: "hl7data==", title: "ORU.hl7" },
      ],
    };
    const result = DiagnosticReportMapper.toDomain(fhir);
    expect(result.pdfData).toBe("pdfdata==");
    expect(result.hl7Data).toBe("hl7data==");
  });

  it("maps unknown FHIR status to 'unknown'", () => {
    const fhir: FhirDiagnosticReport = {
      ...minimalFhir,
      status: "not-a-real-status",
    };
    const result = DiagnosticReportMapper.toDomain(fhir);
    expect(result.status).toBe("unknown");
  });

  it("handles missing subject gracefully", () => {
    const { subject: _unused, ...rest } = minimalFhir;
    const fhir: FhirDiagnosticReport = { ...rest };
    const result = DiagnosticReportMapper.toDomain(fhir);
    expect(result.patientId).toBe("");
    expect(result.patientDisplay).toBe("");
  });

  it("handles missing id gracefully", () => {
    const { id: _unused, ...rest } = minimalFhir;
    const fhir: FhirDiagnosticReport = { ...rest };
    const result = DiagnosticReportMapper.toDomain(fhir);
    expect(result.id).toBe("");
  });

  it("uses meta.lastUpdated as fallback effectiveDate", () => {
    const fhir: FhirDiagnosticReport = {
      ...minimalFhir,
      meta: { lastUpdated: "2024-03-15T10:00:00Z" },
    };
    const result = DiagnosticReportMapper.toDomain(fhir);
    expect(result.effectiveDate).toBe("2024-03-15T10:00:00Z");
  });

  it("prefers effectiveDateTime over issued and meta.lastUpdated", () => {
    const fhir: FhirDiagnosticReport = {
      ...minimalFhir,
      effectiveDateTime: "2024-01-01",
      issued: "2024-01-02",
      meta: { lastUpdated: "2024-01-03" },
    };
    const result = DiagnosticReportMapper.toDomain(fhir);
    expect(result.effectiveDate).toBe("2024-01-01");
  });
});

