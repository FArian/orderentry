/**
 * AccessGuard — translates SessionUserWithOrg into FHIR query filter parameters.
 *
 * Called by API routes (patients, service-requests, diagnostic-reports) to
 * enforce the three-level access control model:
 *
 *   full → no filter (ZLZ/ZetLab internal + bootstrap admin)
 *   org  → managingOrganization IN allowedOrgIds (external org-admin)
 *   own  → requester = Practitioner/{practitionerFhirId} (external physician)
 *
 * Fail-closed: if accessLevel is missing and role is not "admin", returns a
 * deny result so the caller can return 403.
 */

import type { SessionUserWithOrg } from "@/lib/auth";

export interface AccessFilter {
  /** No filter — caller may pass all query params as-is. */
  type: "full";
}

export interface OrgFilter {
  /** Filter by managing organization. */
  type: "org";
  orgFhirIds: string[];
}

export interface OwnFilter {
  /** Filter by practitioner (requester). */
  type: "own";
  practitionerFhirId: string;
}

export interface DenyResult {
  type: "deny";
  httpStatus: 401 | 403;
  message: string;
}

export type AccessGuardResult = AccessFilter | OrgFilter | OwnFilter | DenyResult;

export function resolveAccessFilter(user: SessionUserWithOrg): AccessGuardResult {
  // Bootstrap admin or internal FHIR user → full access
  if (user.role === "admin" || user.accessLevel === "full" || user.isInternal) {
    return { type: "full" };
  }

  // No accessLevel set and not admin → legacy user without FHIR link
  // Fall back to profile-based org filter (backward compat)
  if (!user.accessLevel) {
    if (user.orgFhirId) {
      return { type: "org", orgFhirIds: [user.orgFhirId] };
    }
    // No org context at all → deny
    return { type: "deny", httpStatus: 403, message: "Kein Zugriffskontext. Bitte erneut anmelden." };
  }

  if (user.accessLevel === "org") {
    const orgIds = user.allowedOrgIds?.length
      ? user.allowedOrgIds
      : user.orgFhirId
        ? [user.orgFhirId]
        : [];
    if (orgIds.length === 0) {
      return { type: "deny", httpStatus: 403, message: "Keine Organisation zugewiesen." };
    }
    return { type: "org", orgFhirIds: orgIds };
  }

  if (user.accessLevel === "own") {
    if (!user.practitionerFhirId) {
      return { type: "deny", httpStatus: 403, message: "Kein Practitioner verknüpft." };
    }
    return { type: "own", practitionerFhirId: user.practitionerFhirId };
  }

  return { type: "deny", httpStatus: 403, message: "Unbekannter Zugriffstyp." };
}
