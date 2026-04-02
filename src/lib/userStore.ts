import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export type UserProfile = {
  gln?: string;
  localId?: string;
  ptype?: string;    // GLN PTYPE: "NAT" (person) | "JUR" (organisation)
  roleType?: string; // GLN ROLE.TYPE e.g. "GrpPra"
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
  // Second GLN: the linked organisation (NAT→PractitionerRole.organization) or parent org (JUR→Organization.partOf)
  orgGln?: string;
  orgName?: string;   // display only, set from lookup
  orgFhirId?: string; // FHIR id of the found/created org resource
};

export type UserRole          = "admin" | "user";
export type UserStatus        = "active" | "pending" | "suspended";
export type UserProviderType  = "local" | "external";
export type UserFhirSyncStatus = "not_synced" | "synced" | "error";

export type User = {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  profile?: UserProfile;
  // Access control
  role?: UserRole;
  status?: UserStatus;
  // External identity (LDAP / SSO)
  providerType?: UserProviderType;
  externalId?: string;
  // FHIR synchronisation state
  fhirSyncStatus?: UserFhirSyncStatus;
  fhirSyncedAt?: string;
  fhirSyncError?: string;
  fhirPractitionerId?: string;
  fhirPractitionerRoleId?: string;
};

const dataDir = path.join(process.cwd(), "data");
const usersFile = path.join(dataDir, "users.json");

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(usersFile);
  } catch {
    await fs.writeFile(usersFile, JSON.stringify({ users: [] }, null, 2), "utf8");
  }
}

export async function getUsers(): Promise<User[]> {
  await ensureDataFile();
  const raw = await fs.readFile(usersFile, "utf8");
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data.users) ? (data.users as User[]) : [];
  } catch {
    // If file is corrupted, reset to empty list
    await fs.writeFile(usersFile, JSON.stringify({ users: [] }, null, 2), "utf8");
    return [];
  }
}

export async function findUser(username: string): Promise<User | undefined> {
  const users = await getUsers();
  const u = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  return u;
}

function hashPassword(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey.toString("hex"));
    });
  });
}

export async function createUser(username: string, password: string): Promise<User> {
  await ensureDataFile();
  const existing = await findUser(username);
  if (existing) {
    throw new Error("Username already exists");
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = await hashPassword(password, salt);
  const user: User = {
    id: crypto.randomUUID(),
    username,
    salt,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  const users = await getUsers();
  users.push(user);
  await fs.writeFile(usersFile, JSON.stringify({ users }, null, 2), "utf8");
  return user;
}

export function validateCredentials(username: string, password: string): string | null {
  const u = username.trim();
  if (!u) return "Username is required";
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(u)) return "Username must be 3-32 chars (letters, numbers, _.-)";
  if (password.length < 8) return "Password must be at least 8 characters";
  return null;
}

export async function getUserById(id: string): Promise<User | undefined> {
  const users = await getUsers();
  return users.find((u) => u.id === id);
}

export async function updateUserProfile(userId: string, profile: UserProfile): Promise<User> {
  const users = await getUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) throw new Error("User not found");
  const existing = users[idx]!;
  users[idx] = { ...existing, profile: { ...existing.profile, ...profile } };
  await fs.writeFile(usersFile, JSON.stringify({ users }, null, 2), "utf8");
  return users[idx]!;
}

/** Admin: update any mutable field except passwordHash/salt. */
export async function updateUser(
  id: string,
  patch: Partial<Omit<User, "id" | "passwordHash" | "salt">>,
): Promise<User> {
  const users = await getUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) throw new Error("User not found");
  users[idx] = { ...users[idx]!, ...patch };
  await fs.writeFile(usersFile, JSON.stringify({ users }, null, 2), "utf8");
  return users[idx]!;
}

/** Admin: hard-delete a user. */
export async function deleteUser(id: string): Promise<void> {
  const users = await getUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) throw new Error("User not found");
  users.splice(idx, 1);
  await fs.writeFile(usersFile, JSON.stringify({ users }, null, 2), "utf8");
}

/** Admin: create a user from an external provider (LDAP/SSO) – no password. */
export async function createExternalUser(data: {
  username: string;
  externalId: string;
  role?: UserRole;
  status?: UserStatus;
  profile?: UserProfile;
}): Promise<User> {
  await ensureDataFile();
  const existing = await findUser(data.username);
  if (existing) throw new Error("Username already exists");
  const user: User = {
    id: crypto.randomUUID(),
    username: data.username,
    passwordHash: "",
    salt: "",
    createdAt: new Date().toISOString(),
    providerType: "external",
    externalId: data.externalId,
    role: data.role ?? "user",
    status: data.status ?? "pending",
    fhirSyncStatus: "not_synced",
    ...(data.profile && { profile: data.profile }),
  };
  const users = await getUsers();
  users.push(user);
  await fs.writeFile(usersFile, JSON.stringify({ users }, null, 2), "utf8");
  return user;
}

/** Update FHIR sync state on a user. */
export async function updateUserFhirSync(
  id: string,
  syncData: {
    fhirSyncStatus: UserFhirSyncStatus;
    fhirSyncedAt?: string;
    fhirSyncError?: string;
    fhirPractitionerId?: string;
    fhirPractitionerRoleId?: string;
  },
): Promise<User> {
  return updateUser(id, syncData);
}

export async function verifyUser(username: string, password: string): Promise<User | null> {
  const user = await findUser(username);
  if (!user) return null;
  const hash = await hashPassword(password, user.salt);
  try {
    const a = Buffer.from(user.passwordHash, "hex");
    const b = Buffer.from(hash, "hex");
    if (a.length !== b.length) return null;
    if (crypto.timingSafeEqual(a, b)) return user;
    return null;
  } catch {
    return null;
  }
}
