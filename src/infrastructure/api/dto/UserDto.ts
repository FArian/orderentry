/**
 * Data Transfer Objects for the /api/users endpoints.
 *
 * Rule: DTOs are plain TypeScript interfaces — no classes, no decorators.
 * httpStatus is internal only; never exposed in OpenAPI response body schemas.
 */

import type { UserFhirSyncStatus, UserProviderType, UserRole, UserStatus } from "@/domain/entities/ManagedUser";

// ── Profile sub-object (same shape as UserProfile in userStore) ───────────────

export interface UserProfileDto {
  gln?: string;
  ahv?: string;
  localId?: string;
  ptype?: string;
  roleType?: string;    // single — backward compat
  roleTypes?: string[]; // multi-role
  firstName?: string;
  lastName?: string;
  organization?: string;
  street?: string;
  streetNo?: string;
  zip?: string;
  city?: string;
  canton?: string;
  country?: string;
  email?: string;
  phone?: string;
  orgGln?: string;
  orgName?: string;
  orgFhirId?: string;
  locationId?: string;   // FHIR Location.id — required for NAT
  locationName?: string; // display name
  zsr?: string;          // Zahlstellenregister-Nummer (NAT + JUR)
  uid?: string;          // Unternehmens-ID CHE-XXX.XXX.XXX (JUR only)
  bur?: string;          // Betriebseinheitsnummer BFS (JUR only)
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

/**
 * POST /api/users — create a new managed user.
 * External systems (LDAP) use providerType:"external" + externalId.
 * Local admin-created users use providerType:"local" + password.
 */
export interface CreateUserRequestDto {
  /** Required. 3-32 chars, alphanumeric + _.- */
  username: string;
  /** "local" (default) | "external" (LDAP/SSO) */
  providerType?: UserProviderType;
  /** Required for local users (min 8 chars) */
  password?: string;
  /** Required for external users — e.g. LDAP DN or UID */
  externalId?: string;
  /** "user" (default) | "admin" */
  role?: UserRole;
  /** Initial lifecycle status — default "active" for local, "pending" for external */
  status?: UserStatus;
  /** Optional profile data to pre-populate */
  profile?: UserProfileDto;
}

/** PUT /api/users/{id} — partial update */
export interface UpdateUserRequestDto {
  role?: UserRole;
  status?: UserStatus;
  externalId?: string;
  profile?: UserProfileDto;
  /** FHIR Practitioner ID linked to this user — used for access level resolution at login. */
  fhirPractitionerId?: string;
}

// ── Response DTOs ─────────────────────────────────────────────────────────────

/** Single user as returned by the API — no passwords, no salts. */
export interface UserResponseDto {
  id: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  providerType: UserProviderType;
  externalId?: string;
  createdAt: string;
  profile: UserProfileDto;
  fhirSyncStatus: UserFhirSyncStatus;
  fhirSyncedAt?: string;
  fhirSyncError?: string;
  fhirPractitionerId?: string;
  fhirPractitionerRoleId?: string;
  /** Individual permissions granted beyond the base role. */
  extraPermissions: string[];
}

/** PUT /api/v1/users/{id}/permissions — assign individual permissions */
export interface UpdatePermissionsRequestDto {
  /** List of permission strings from ASSIGNABLE_PERMISSIONS. */
  permissions: string[];
}

export interface UpdatePermissionsResponseDto {
  id: string;
  extraPermissions: string[];
  error?: string;
  httpStatus?: number;
}

/** GET /api/users — paginated list */
export interface ListUsersQueryDto {
  q?: string;
  role?: UserRole;
  status?: UserStatus;
  page?: number;
  pageSize?: number;
}

export interface PagedUsersResponseDto {
  data: UserResponseDto[];
  total: number;
  page: number;
  pageSize: number;
  error?: string;
  httpStatus?: number;
}

/** DELETE /api/users/{id} */
export interface DeleteUserResponseDto {
  deleted: boolean;
  error?: string;
  httpStatus?: number;
}

/** POST /api/users/{id}/sync */
export interface UserSyncResponseDto {
  synced: boolean;
  fhirPractitionerId?: string;
  fhirPractitionerRoleId?: string;
  error?: string;
  httpStatus?: number;
}
