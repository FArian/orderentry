/**
 * IUserRepository — application-layer interface for managed user persistence.
 *
 * Infrastructure provides the concrete implementation (JSON file store).
 * Tests inject a mock implementation.
 */

import type { ManagedUser, ManagedUserProfile, UserFhirSyncStatus, UserRole, UserStatus } from "@/domain/entities/ManagedUser";

export interface CreateUserData {
  username: string;
  role?: UserRole;
  status?: UserStatus;
  providerType?: "local" | "external";
  externalId?: string;
  profile?: ManagedUserProfile;
  /** Only for local users — will be hashed by the implementation. */
  password?: string;
}

export interface UpdateUserData {
  role?: UserRole;
  status?: UserStatus;
  externalId?: string;
  profile?: Partial<ManagedUserProfile>;
}

export interface FhirSyncResult {
  fhirSyncStatus: UserFhirSyncStatus;
  fhirSyncedAt?: string;
  fhirSyncError?: string;
  fhirPractitionerId?: string;
  fhirPractitionerRoleId?: string;
}

export interface IUserRepository {
  findAll(filters?: { role?: UserRole; status?: UserStatus }): Promise<ManagedUser[]>;
  findById(id: string): Promise<ManagedUser | null>;
  findByUsername(username: string): Promise<ManagedUser | null>;
  create(data: CreateUserData): Promise<ManagedUser>;
  update(id: string, data: UpdateUserData): Promise<ManagedUser>;
  delete(id: string): Promise<void>;
  updateFhirSync(id: string, result: FhirSyncResult): Promise<ManagedUser>;
}
