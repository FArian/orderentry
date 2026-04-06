/**
 * IUserRepository — application-layer contract for user persistence.
 */

import type { User, UserProfile, UserRole, UserStatus, UserFhirSyncStatus } from "@/domain/entities/User";

export interface IUserRepository {
  findAll(): Promise<User[]>;
  findById(id: string): Promise<User | undefined>;
  findByUsername(username: string): Promise<User | undefined>;
  create(username: string, passwordHash: string, salt: string, profile?: UserProfile): Promise<User>;
  createExternal(data: { username: string; externalId: string; role?: UserRole; status?: UserStatus; profile?: UserProfile }): Promise<User>;
  update(id: string, patch: Partial<Omit<User, "id" | "passwordHash" | "salt">>): Promise<User>;
  updatePassword(id: string, passwordHash: string, salt: string): Promise<void>;
  updateProfile(id: string, profile: UserProfile): Promise<User>;
  updateFhirSync(id: string, data: { fhirSyncStatus: UserFhirSyncStatus; fhirSyncedAt?: string; fhirSyncError?: string; fhirPractitionerId?: string; fhirPractitionerRoleId?: string }): Promise<User>;
  updateExtraPermissions(id: string, permissions: string[]): Promise<User>;
  setApiToken(id: string, hash: string): Promise<void>;
  clearApiToken(id: string): Promise<void>;
  delete(id: string): Promise<void>;
  hasAnyAdmin(): Promise<boolean>;
}
