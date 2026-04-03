/**
 * Data Transfer Objects for the /api/roles endpoints.
 *
 * Rules:
 *  - Plain TypeScript interfaces — no classes, no decorators.
 *  - httpStatus is internal only; never exposed in OpenAPI response body schemas.
 */

// ── Catalog entry ─────────────────────────────────────────────────────────────

export interface RoleCatalogEntryDto {
  id:        string;
  code:      string;
  display:   string;
  system?:   string;
  createdAt: string;
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

export interface CreateRoleRequestDto {
  /** Required. Must be unique (case-insensitive). */
  code:     string;
  /** Required. Human-readable display name. */
  display:  string;
  /** Optional FHIR coding system URI / OID. */
  system?:  string;
}

export interface UpdateRoleRequestDto {
  code?:    string;
  display?: string;
  /** Pass empty string to clear the system value. */
  system?:  string;
}

// ── Response DTOs ─────────────────────────────────────────────────────────────

export interface ListRolesResponseDto {
  data:        RoleCatalogEntryDto[];
  total?:      number;
  error?:      string;
  httpStatus?: number;
}

export interface DeleteRoleResponseDto {
  deleted:    boolean;
  error?:     string;
  httpStatus?: number;
}
