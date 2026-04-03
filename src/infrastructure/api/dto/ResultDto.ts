/**
 * Data Transfer Objects for the /api/diagnostic-reports endpoint.
 *
 * DTOs define the public API contract — they are independent of both
 * the FHIR wire format and the domain entities.
 */

/** Query parameters accepted by GET /api/diagnostic-reports */
export interface ListResultsQueryDto {
  /** Free-text code search forwarded to FHIR as ?code= */
  q?: string;
  /** FHIR DiagnosticReport status filter (e.g. "final", "preliminary") */
  status?: string;
  /** Filter by exact patient FHIR ID */
  patientId?: string;
  /** Filter by patient name (chained FHIR search) */
  patientName?: string;
  /** Filter by ServiceRequest identifier (order number) */
  orderNumber?: string;
  /** 1-based page number (default: 1) */
  page?: number;
  /** Results per page (default: 20) */
  pageSize?: number;
  /** FHIR Organization ID — restricts results to patients of this org */
  orgFhirId?: string;
  /** Organization GLN — fallback when orgFhirId not yet resolved */
  orgGln?: string;
}

/** A single DiagnosticReport as returned by the API */
export interface ResultResponseDto {
  id: string;
  status: string;
  codeText: string;
  category: string;
  effectiveDate: string;
  resultCount: number;
  conclusion: string;
  basedOn: string[];
  patientId: string;
  patientDisplay: string;
  pdfData: string | null;
  pdfTitle: string | null;
  hl7Data: string | null;
  hl7Title: string | null;
}

/** Paginated list response for GET /api/diagnostic-reports */
export interface PagedResultsResponseDto {
  data: ResultResponseDto[];
  total: number;
  page: number;
  pageSize: number;
  /** Present only on error responses */
  error?: string;
  /** Internal: HTTP status to use in the route response; stripped before JSON output */
  httpStatus?: number;
}
