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
