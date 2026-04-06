/**
 * User — domain entity for user persistence.
 *
 * Includes credential fields (passwordHash, salt) that IUserRepository needs
 * for authentication operations.
 *
 * For the admin API response shape (no sensitive fields) use ManagedUser.
 *
 * Role / status union types are defined in ManagedUser and re-exported here
 * so that IUserRepository callers need only one import.
 */

import type { UserRole, UserStatus, UserProviderType, UserFhirSyncStatus } from "./ManagedUser";

// Re-export role/status types so callers can import everything from this file.
export type { UserRole, UserStatus, UserProviderType, UserFhirSyncStatus } from "./ManagedUser";

export interface UserProfile {
  gln?:          string;
  ahv?:          string;
  localId?:      string;
  ptype?:        string;
  roleType?:     string;
  roleTypes?:    string[];
  firstName?:    string;
  lastName?:     string;
  organization?: string;
  street?:       string;
  streetNo?:     string;
  zip?:          string;
  city?:         string;
  canton?:       string;
  country?:      string;
  email?:        string;
  phone?:        string;
  orgGln?:       string;
  orgName?:      string;
  orgFhirId?:    string;
  locationId?:   string;
  locationName?: string;
  zsr?:          string;
  uid?:          string;
  bur?:          string;
}

export interface User {
  id:                      string;
  username:                string;
  passwordHash:            string;
  salt:                    string;
  createdAt:               string;
  profile?:                UserProfile;
  role?:                   UserRole;
  status?:                 UserStatus;
  providerType?:           UserProviderType;
  externalId?:             string;
  fhirSyncStatus?:         UserFhirSyncStatus;
  fhirSyncedAt?:           string;
  fhirSyncError?:          string;
  fhirPractitionerId?:     string;
  fhirPractitionerRoleId?: string;
  apiTokenHash?:           string;
  apiTokenCreatedAt?:      string;
  /** Individual permissions granted beyond the base role. Resolved at auth time. */
  extraPermissions?:       string[];
}
