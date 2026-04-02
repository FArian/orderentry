// Domain entity — framework-independent, no React, no API calls.

export enum ResultStatus {
  REGISTERED  = "registered",
  PARTIAL     = "partial",
  PRELIMINARY = "preliminary",
  FINAL       = "final",
  AMENDED     = "amended",
  CORRECTED   = "corrected",
  CANCELLED   = "cancelled",
  UNKNOWN     = "unknown",
}

export interface Result {
  id: string;
  status: ResultStatus;
  codeText: string;
  category: string;
  effectiveDate: string;
  resultCount: number;
  conclusion: string;
  /** FHIR references e.g. "ServiceRequest/<id>" */
  basedOn: string[];
  patientId: string;
  patientDisplay: string;
  pdfData: string | null;
  pdfTitle: string | null;
  hl7Data: string | null;
  hl7Title: string | null;
}
