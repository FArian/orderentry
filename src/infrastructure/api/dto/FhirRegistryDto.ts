/**
 * DTOs for the FHIR Registry admin endpoints.
 *
 * GET  /api/fhir/organizations   → ListOrganizationsResponseDto
 * POST /api/fhir/organizations   → FhirOrganizationDto
 * GET  /api/fhir/practitioners   → ListPractitionersResponseDto
 * POST /api/fhir/practitioners   → FhirPractitionerDto
 */

// ── Organization ───────────────────────────────────────────────────────────────

export interface FhirOrganizationDto {
  id:   string;
  name: string;
  gln:  string;
}

export interface CreateOrganizationRequestDto {
  name: string;
  gln:  string;
}

export interface ListOrganizationsResponseDto {
  organizations: FhirOrganizationDto[];
  total:         number;
  httpStatus?:   number;
}

// ── Practitioner ───────────────────────────────────────────────────────────────

export interface FhirPractitionerDto {
  id:                 string;
  firstName:          string;
  lastName:           string;
  gln:                string;
  organizationId:     string;
  organizationName:   string;
  roleCode:           string;
  practitionerRoleId: string;
}

export interface CreatePractitionerRequestDto {
  firstName:      string;
  lastName:       string;
  gln:            string;
  organizationId: string;
  roleCode:       string;
}

export interface ListPractitionersResponseDto {
  practitioners: FhirPractitionerDto[];
  total:         number;
  httpStatus?:   number;
}

// ── Shared error ───────────────────────────────────────────────────────────────

export interface FhirRegistryErrorDto {
  error:       string;
  httpStatus?: number;
}
