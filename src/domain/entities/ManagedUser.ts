/**
 * ManagedUser — domain entity for admin-managed users.
 *
 * This is the clean domain view of a user:
 *   - No passwords, no salts
 *   - Includes FHIR sync state and external provider info
 *   - Used by UsersController, useUsers hook, and UsersPage
 */

export type UserRole           = "admin" | "user";
export type UserStatus         = "active" | "pending" | "suspended";
export type UserProviderType   = "local" | "external";
export type UserFhirSyncStatus = "not_synced" | "synced" | "error";

export interface ManagedUserProfile {
  gln?: string;
  localId?: string;
  ptype?: string;       // "NAT" | "JUR"
  roleType?: string;    // single role — kept for backward compat
  roleTypes?: string[]; // multi-role — preferred when set
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
  locationId?: string;   // FHIR Location.id — required for NAT (PractitionerRole.location)
  locationName?: string; // display name of the location
  ahv?: string;          // Swiss AHV/AVS number (NAT/PER)
  zsr?: string;          // Zahlstellenregister-Nummer santésuisse (NAT + JUR)
  uid?: string;          // Unternehmens-ID CHE-XXX.XXX.XXX (JUR only)
  bur?: string;          // Betriebseinheitsnummer BFS (JUR only)
}

export interface ManagedUser {
  id: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  providerType: UserProviderType;
  externalId?: string;
  createdAt: string;
  profile?: ManagedUserProfile;
  // FHIR synchronisation
  fhirSyncStatus: UserFhirSyncStatus;
  fhirSyncedAt?: string;
  fhirSyncError?: string;
  fhirPractitionerId?: string;
  fhirPractitionerRoleId?: string;
}
