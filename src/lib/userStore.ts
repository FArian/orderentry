/**
 * userStore — public API for user persistence.
 *
 * Previously: read/wrote data/users.json directly.
 * Now:        thin wrapper over PrismaUserRepository.
 *
 * All callers (API routes, controllers, auth) continue to import from here —
 * no breaking changes across the codebase.  The storage engine is Prisma,
 * configured via DB_PROVIDER + DATABASE_URL env vars.
 */

import crypto from "crypto";
import { userRepository } from "@/infrastructure/repositories/PrismaUserRepository";
import { createLogger } from "@/infrastructure/logging/Logger";
import type { User, UserProfile, UserRole, UserStatus, UserProviderType, UserFhirSyncStatus } from "@/domain/entities/User";

// Re-exported so all existing callers of @/lib/userStore continue to work unchanged.
export type { User, UserProfile, UserRole, UserStatus, UserProviderType, UserFhirSyncStatus } from "@/domain/entities/User";

const log = createLogger("userStore");

// ── Password helpers ──────────────────────────────────────────────────────────

function hashPassword(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey.toString("hex"));
    });
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getUsers(): Promise<User[]> {
  return userRepository.findAll();
}

export async function findUser(username: string): Promise<User | undefined> {
  return userRepository.findByUsername(username);
}

export async function getUserById(id: string): Promise<User | undefined> {
  return userRepository.findById(id);
}

export function validateCredentials(username: string, password: string): string | null {
  const u = username.trim();
  if (!u) return "Username is required";
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(u)) return "Username must be 3-32 chars (letters, numbers, _.-)";
  if (password.length < 8) return "Password must be at least 8 characters";
  return null;
}

export async function createUser(username: string, password: string, profile?: UserProfile): Promise<User> {
  const existing = await userRepository.findByUsername(username);
  if (existing) throw new Error("Username already exists");
  const salt         = crypto.randomBytes(16).toString("hex");
  const passwordHash = await hashPassword(password, salt);
  return userRepository.create(username, passwordHash, salt, profile);
}

export async function updateUserProfile(userId: string, profile: UserProfile): Promise<User> {
  return userRepository.updateProfile(userId, profile);
}

export async function updateUser(
  id: string,
  patch: Partial<Omit<User, "id" | "passwordHash" | "salt">>,
): Promise<User> {
  return userRepository.update(id, patch);
}

export async function deleteUser(id: string): Promise<void> {
  return userRepository.delete(id);
}

export async function createExternalUser(data: {
  username:   string;
  externalId: string;
  role?:      UserRole;
  status?:    UserStatus;
  profile?:   UserProfile;
}): Promise<User> {
  const existing = await userRepository.findByUsername(data.username);
  if (existing) throw new Error("Username already exists");
  return userRepository.createExternal(data);
}

export async function updateUserFhirSync(
  id: string,
  syncData: {
    fhirSyncStatus:          UserFhirSyncStatus;
    fhirSyncedAt?:           string;
    fhirSyncError?:          string;
    fhirPractitionerId?:     string;
    fhirPractitionerRoleId?: string;
  },
): Promise<User> {
  return userRepository.updateFhirSync(id, syncData);
}

export async function updateUserPassword(userId: string, newPassword: string): Promise<void> {
  const salt         = crypto.randomBytes(16).toString("hex");
  const passwordHash = await hashPassword(newPassword, salt);
  return userRepository.updatePassword(userId, passwordHash, salt);
}

export async function setApiToken(userId: string, hash: string): Promise<void> {
  return userRepository.setApiToken(userId, hash);
}

export async function clearApiToken(userId: string): Promise<void> {
  return userRepository.clearApiToken(userId);
}

export async function updateExtraPermissions(userId: string, permissions: string[]): Promise<User> {
  return userRepository.updateExtraPermissions(userId, permissions);
}

export async function verifyUser(username: string, password: string): Promise<User | null> {
  const user = await userRepository.findByUsername(username);
  if (!user) return null;
  const hash = await hashPassword(password, user.salt);
  try {
    const a = Buffer.from(user.passwordHash, "hex");
    const b = Buffer.from(hash, "hex");
    if (a.length !== b.length) return null;
    return crypto.timingSafeEqual(a, b) ? user : null;
  } catch {
    return null;
  }
}

// ── Bootstrap admin ───────────────────────────────────────────────────────────

export async function ensureBootstrapAdmin(): Promise<void> {
  const hasAdmin = await userRepository.hasAnyAdmin();
  if (hasAdmin) return;

  const bootstrapUsername = (process.env.BOOTSTRAP_ADMIN_USER     || "admin").toLowerCase();
  const bootstrapPassword =  process.env.BOOTSTRAP_ADMIN_PASSWORD  || "Admin1234!";

  const existing = await userRepository.findByUsername(bootstrapUsername);
  if (existing) {
    await userRepository.update(existing.id, { role: "admin", status: "active" });
    log.warn(`Bootstrap: promoted "${existing.username}" to admin`);
    return;
  }

  const salt         = crypto.randomBytes(16).toString("hex");
  const passwordHash = await hashPassword(bootstrapPassword, salt);
  await userRepository.create(bootstrapUsername, passwordHash, salt);
  await userRepository.update(
    (await userRepository.findByUsername(bootstrapUsername))!.id,
    { role: "admin", status: "active", providerType: "local", fhirSyncStatus: "not_synced" },
  );

  log.warn("Bootstrap admin created — change password immediately", {
    username: bootstrapUsername,
  });
}
