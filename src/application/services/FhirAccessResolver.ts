/**
 * FhirAccessResolver — determines the AccessLevel for a user at login time.
 *
 * Logic (strict priority order):
 *  Rule 0: DB role = "admin" → FULL (DB-Admins brauchen keine FHIR PractitionerRole)
 *  Rule 1: FHIR unavailable → throw (fail-safe; Rule 0 already returned)
 *  Rule 2: Active PractitionerRole in internal org → FULL
 *  Rule 3: Active PractitionerRole with org-admin code in external org → ORG
 *  Rule 4: Active PractitionerRole with physician code in external org → OWN
 *  Rule 5: No matching role → throw (login denied)
 */

import {
  ACCESS_LEVELS,
  INTERNAL_ROLE_CODES_DEFAULT,
  ORG_ADMIN_ROLE_CODES_DEFAULT,
  type AccessLevelInfo,
} from "@/domain/valueObjects/AccessLevel";

interface FhirPractitionerRole {
  id?: string;
  active?: boolean;
  practitioner?: { reference?: string };
  organization?: { reference?: string };
  code?: Array<{
    coding?: Array<{ system?: string; code?: string }>;
  }>;
}

interface FhirBundle {
  entry?: Array<{ resource?: FhirPractitionerRole }>;
}

export interface FhirAccessResolverOptions {
  fhirBaseUrl: string;
  internalOrgIds: string[];
  /** SNOMED codes for internal staff — defaults to INTERNAL_ROLE_CODES_DEFAULT */
  internalRoleCodes?: string[];
  /** SNOMED codes for org-admins — defaults to ORG_ADMIN_ROLE_CODES_DEFAULT */
  orgAdminRoleCodes?: string[];
  fetchFn?: typeof fetch;
}

export class FhirAccessResolver {
  private readonly fhirBaseUrl: string;
  private readonly internalOrgIds: string[];
  private readonly internalRoleCodes: string[];
  private readonly orgAdminRoleCodes: string[];
  private readonly fetchFn: typeof fetch;

  constructor(options: FhirAccessResolverOptions) {
    this.fhirBaseUrl = options.fhirBaseUrl;
    this.internalOrgIds = options.internalOrgIds;
    this.internalRoleCodes = options.internalRoleCodes ?? [...INTERNAL_ROLE_CODES_DEFAULT];
    this.orgAdminRoleCodes = options.orgAdminRoleCodes ?? [...ORG_ADMIN_ROLE_CODES_DEFAULT];
    this.fetchFn = options.fetchFn ?? fetch;
  }

  /**
   * Resolves access level for a user.
   *
   * @param practitionerFhirId - FHIR Practitioner ID from user profile (e.g. "prac-von-rohr-anna")
   * @param dbRole - DB role field ("admin" | "user")
   * @returns AccessLevelInfo — level + metadata for session cookie
   * @throws Error if FHIR is unavailable or no valid role found (login denied)
   */
  async resolve(practitionerFhirId: string | undefined, dbRole: string): Promise<AccessLevelInfo> {
    // Rule 0: DB-Admins erhalten immer FULL-Zugriff — FHIR-Lookup nicht nötig.
    // Admins werden in der lokalen DB verwaltet, nicht über FHIR PractitionerRoles.
    if (dbRole === "admin") {
      return {
        level: ACCESS_LEVELS.FULL,
        ...(practitionerFhirId !== undefined && { practitionerFhirId }),
        isInternal: true,
        allowedOrgIds: [],
      };
    }

    if (!practitionerFhirId) {
      throw new Error("Kein FHIR-Practitioner verknüpft. Login verweigert.");
    }

    const roles = await this.loadPractitionerRoles(practitionerFhirId);

    if (roles.length === 0) {
      throw new Error("Keine aktive PractitionerRole gefunden. Login verweigert.");
    }

    const internalRole = roles.find((r) => this.isInternalOrg(r));
    if (internalRole) {
      return {
        level: ACCESS_LEVELS.FULL,
        practitionerFhirId,
        isInternal: true,
        allowedOrgIds: [],
      };
    }

    const orgAdminRoles = roles.filter((r) => this.hasOrgAdminCode(r));
    if (orgAdminRoles.length > 0) {
      const allowedOrgIds = orgAdminRoles
        .map((r) => this.extractOrgId(r))
        .filter((id): id is string => id !== undefined);
      return {
        level: ACCESS_LEVELS.ORG,
        practitionerFhirId,
        isInternal: false,
        allowedOrgIds,
      };
    }

    const hasPhysicianRole = roles.some((r) => !this.hasOrgAdminCode(r));
    if (hasPhysicianRole) {
      const allowedOrgIds = roles
        .map((r) => this.extractOrgId(r))
        .filter((id): id is string => id !== undefined);
      return {
        level: ACCESS_LEVELS.OWN,
        practitionerFhirId,
        isInternal: false,
        allowedOrgIds,
      };
    }

    throw new Error("Keine gültige Rolle gefunden. Login verweigert.");
  }

  private async loadPractitionerRoles(practitionerFhirId: string): Promise<FhirPractitionerRole[]> {
    const url = `${this.fhirBaseUrl}/PractitionerRole?practitioner=${encodeURIComponent(practitionerFhirId)}&active=true&_count=50`;

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        headers: { Accept: "application/fhir+json" },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new Error("FHIR-Server nicht erreichbar. Login verweigert.");
    }

    if (!response.ok) {
      throw new Error(`FHIR-Fehler ${response.status}. Login verweigert.`);
    }

    const bundle = (await response.json()) as FhirBundle;
    return (bundle.entry ?? [])
      .map((e) => e.resource)
      .filter((r): r is FhirPractitionerRole => r !== undefined && r.active !== false);
  }

  private isInternalOrg(role: FhirPractitionerRole): boolean {
    const orgId = this.extractOrgId(role);
    if (!orgId) return false;
    return this.internalOrgIds.some(
      (id) => orgId === id || orgId === `Organization/${id}`,
    );
  }

  private hasOrgAdminCode(role: FhirPractitionerRole): boolean {
    return (role.code ?? []).some((c) =>
      (c.coding ?? []).some((coding) =>
        this.orgAdminRoleCodes.includes(coding.code ?? ""),
      ),
    );
  }

  private extractOrgId(role: FhirPractitionerRole): string | undefined {
    const ref = role.organization?.reference;
    if (!ref) return undefined;
    return ref.startsWith("Organization/") ? ref.slice("Organization/".length) : ref;
  }
}
