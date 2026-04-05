/**
 * AccessLevel — immutable value object representing the data access scope
 * granted to an authenticated user.
 *
 * Determined at login time by FhirAccessResolver based on PractitionerRole
 * resources in the FHIR server. Cached in the session cookie.
 *
 * Priority (highest to lowest):
 *   full  — internal org member (ZLZ/ZetLab) or bootstrap admin
 *   org   — external org-admin (managingOrganization filter)
 *   own   — external practitioner (requester filter)
 */

export type AccessLevelType = "full" | "org" | "own";

export const ACCESS_LEVELS = {
  /** No filter — sees all patients, orders, results. ZLZ/ZetLab staff + bootstrap admin. */
  FULL: "full" as AccessLevelType,

  /** Filter by managingOrganization IN allowedOrgIds. External org admins. */
  ORG: "org" as AccessLevelType,

  /** Filter by ServiceRequest.requester = practitionerId. External physicians. */
  OWN: "own" as AccessLevelType,
} as const;

/**
 * Default SNOMED codes — used as fallback when ENV vars are not set.
 * Override via ORDERENTRY_SNOMED__ROLE_INTERNAL, ORDERENTRY_SNOMED__ROLE_ORG_ADMIN,
 * ORDERENTRY_SNOMED__ROLE_PHYSICIAN in the environment.
 */

/** SNOMED codes that indicate internal lab staff (Level A). */
export const INTERNAL_ROLE_CODES_DEFAULT = [
  "159418007", // Medical laboratory technician
  "159011000", // Pathologist
] as const;

/** SNOMED codes that indicate an org-admin (Level B). */
export const ORG_ADMIN_ROLE_CODES_DEFAULT = [
  "224608005", // Administrative officer
  "394572006", // Medical secretary
] as const;

/** SNOMED codes that indicate an external physician (Level C). */
export const PHYSICIAN_ROLE_CODES_DEFAULT = [
  "309343006", // Physician
  "59058001",  // General physician
  "106289002", // Dental surgeon
] as const;

// Backward-compatible exports (used by tests and existing code)
export const INTERNAL_ROLE_CODES  = INTERNAL_ROLE_CODES_DEFAULT;
export const ORG_ADMIN_ROLE_CODES = ORG_ADMIN_ROLE_CODES_DEFAULT;
export const PHYSICIAN_ROLE_CODES = PHYSICIAN_ROLE_CODES_DEFAULT;

export interface AccessLevelInfo {
  level: AccessLevelType;
  /** FHIR Practitioner ID — e.g. "prac-von-rohr-anna". Undefined for bootstrap admin. */
  practitionerFhirId?: string;
  /** True when the practitioner has a role in an internal org (ZLZ/ZetLab). */
  isInternal: boolean;
  /** Org IDs the user may access (Level B only — managingOrganization filter). */
  allowedOrgIds: string[];
}
