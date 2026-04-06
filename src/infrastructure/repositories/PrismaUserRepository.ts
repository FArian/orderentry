/**
 * PrismaUserRepository — concrete IUserRepository backed by Prisma.
 *
 * Works with SQLite (default), PostgreSQL, and MSSQL — only DATABASE_URL
 * and DB_PROVIDER in ENV need to change. No business logic is touched.
 *
 * UserProfile is stored as a JSON string in the `profile` column.
 * SQLite has no native JSON type in Prisma 5; we serialize/deserialize manually.
 * On PostgreSQL, change the column to `Json?` in schema.prisma for native JSONB.
 */

import type { IUserRepository } from "@/application/interfaces/repositories/IUserRepository";
import type { User, UserProfile, UserRole, UserStatus, UserFhirSyncStatus } from "@/domain/entities/User";
import { prisma } from "../db/prismaClient";
import type { User as PrismaUser } from "@prisma/client";

function parseExtraPermissions(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function toUser(row: PrismaUser): User {
  const extraPermissions = parseExtraPermissions(row.extraPermissions);
  return {
    id:                     row.id,
    username:               row.username,
    passwordHash:           row.passwordHash,
    salt:                   row.salt,
    createdAt:              row.createdAt.toISOString(),
    role:                   (row.role as UserRole) ?? "user",
    status:                 (row.status as UserStatus) ?? "active",
    providerType:           (row.providerType as "local" | "external") ?? "local",
    ...(row.externalId             && { externalId:             row.externalId }),
    fhirSyncStatus:         (row.fhirSyncStatus as UserFhirSyncStatus) ?? "not_synced",
    ...(row.fhirSyncedAt           && { fhirSyncedAt:           row.fhirSyncedAt.toISOString() }),
    ...(row.fhirSyncError          && { fhirSyncError:          row.fhirSyncError }),
    ...(row.fhirPractitionerId     && { fhirPractitionerId:     row.fhirPractitionerId }),
    ...(row.fhirPractitionerRoleId && { fhirPractitionerRoleId: row.fhirPractitionerRoleId }),
    ...(row.apiTokenHash           && { apiTokenHash:           row.apiTokenHash }),
    ...(row.apiTokenCreatedAt      && { apiTokenCreatedAt:      row.apiTokenCreatedAt.toISOString() }),
    ...(row.profile                && { profile:                JSON.parse(row.profile) as UserProfile }),
    ...(extraPermissions.length > 0 && { extraPermissions }),
  };
}

export class PrismaUserRepository implements IUserRepository {
  async findAll(): Promise<User[]> {
    const rows = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map(toUser);
  }

  async findById(id: string): Promise<User | undefined> {
    const row = await prisma.user.findUnique({ where: { id } });
    return row ? toUser(row) : undefined;
  }

  async findByUsername(username: string): Promise<User | undefined> {
    // SQLite stores usernames lowercase (enforced in create()).
    // PostgreSQL supports mode:"insensitive" but SQLite does not.
    const row = await prisma.user.findFirst({
      where: { username: username.toLowerCase() },
    });
    return row ? toUser(row) : undefined;
  }

  async create(username: string, passwordHash: string, salt: string, profile?: UserProfile): Promise<User> {
    const row = await prisma.user.create({
      data: { username: username.toLowerCase(), passwordHash, salt, ...(profile && { profile: JSON.stringify(profile) }) },
    });
    return toUser(row);
  }

  async createExternal(data: { username: string; externalId: string; role?: UserRole; status?: UserStatus; profile?: UserProfile }): Promise<User> {
    const row = await prisma.user.create({
      data: {
        username:     data.username,
        passwordHash: "",
        salt:         "",
        providerType: "external",
        externalId:   data.externalId,
        role:         data.role    ?? "user",
        status:       data.status  ?? "pending",
        fhirSyncStatus: "not_synced",
        ...(data.profile && { profile: JSON.stringify(data.profile) }),
      },
    });
    return toUser(row);
  }

  async update(id: string, patch: Partial<Omit<User, "id" | "passwordHash" | "salt">>): Promise<User> {
    const data: Record<string, unknown> = { ...patch };
    // Convert string dates to Date objects for Prisma
    if (typeof data["fhirSyncedAt"] === "string") data["fhirSyncedAt"] = new Date(data["fhirSyncedAt"] as string);
    if (typeof data["apiTokenCreatedAt"] === "string") data["apiTokenCreatedAt"] = new Date(data["apiTokenCreatedAt"] as string);
    // Serialize profile object to JSON string (SQLite stores profile as TEXT)
    if (data["profile"] !== undefined && data["profile"] !== null && typeof data["profile"] === "object") {
      data["profile"] = JSON.stringify(data["profile"]);
    }
    // Remove undefined keys
    for (const key of Object.keys(data)) {
      if (data[key] === undefined) delete data[key];
    }
    const row = await prisma.user.update({ where: { id }, data });
    return toUser(row);
  }

  async updatePassword(id: string, passwordHash: string, salt: string): Promise<void> {
    await prisma.user.update({ where: { id }, data: { passwordHash, salt } });
  }

  async updateProfile(id: string, profile: UserProfile): Promise<User> {
    const existing     = await prisma.user.findUniqueOrThrow({ where: { id } });
    const existingProf = existing.profile ? JSON.parse(existing.profile) as object : {};
    const merged       = { ...existingProf, ...profile };
    const row          = await prisma.user.update({ where: { id }, data: { profile: JSON.stringify(merged) } });
    return toUser(row);
  }

  async updateFhirSync(id: string, data: { fhirSyncStatus: UserFhirSyncStatus; fhirSyncedAt?: string; fhirSyncError?: string; fhirPractitionerId?: string; fhirPractitionerRoleId?: string }): Promise<User> {
    return this.update(id, data);
  }

  async setApiToken(id: string, hash: string): Promise<void> {
    await prisma.user.update({ where: { id }, data: { apiTokenHash: hash, apiTokenCreatedAt: new Date() } });
  }

  async clearApiToken(id: string): Promise<void> {
    await prisma.user.update({ where: { id }, data: { apiTokenHash: null, apiTokenCreatedAt: null } });
  }

  async updateExtraPermissions(id: string, permissions: string[]): Promise<User> {
    const row = await prisma.user.update({
      where: { id },
      data:  { extraPermissions: JSON.stringify(permissions) },
    });
    return toUser(row);
  }

  async delete(id: string): Promise<void> {
    await prisma.user.delete({ where: { id } });
  }

  async hasAnyAdmin(): Promise<boolean> {
    const count = await prisma.user.count({ where: { role: "admin" } });
    return count > 0;
  }
}

export const userRepository: IUserRepository = new PrismaUserRepository();
