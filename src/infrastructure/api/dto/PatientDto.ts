/**
 * Data Transfer Objects for the /api/patients endpoint.
 */

/** Query parameters accepted by GET /api/patients */
export interface ListPatientsQueryDto {
  /** Name search string (forwarded to FHIR as ?name=) */
  q?: string;
  /** 1-based page number (default: 1) */
  page?: number;
  /** Results per page (default: 10) */
  pageSize?: number;
  /** When true, returns inactive patients instead of active ones */
  showInactive?: boolean;
  /** When true, returns all patients regardless of active status (overrides showInactive) */
  showAll?: boolean;
  /**
   * FHIR Organization resource ID (e.g. "klinik-hirslanden").
   * When set, only patients managed by this organization are returned.
   * Takes precedence over orgGln.
   */
  orgFhirId?: string;
  /**
   * Organization GLN (13 digits). Used as fallback when orgFhirId is not yet
   * resolved. Translates to FHIR organization:identifier search.
   */
  orgGln?: string;
}

/** A single Patient as returned by the API */
export interface PatientResponseDto {
  id: string;
  name: string;
  address: string;
  createdAt: string;
}

/** Paginated list response for GET /api/patients */
export interface PagedPatientsResponseDto {
  data: PatientResponseDto[];
  total: number;
  page: number;
  pageSize: number;
  /** Present only on error responses */
  error?: string;
  /** Internal: HTTP status to use in the route response */
  httpStatus?: number;
}
