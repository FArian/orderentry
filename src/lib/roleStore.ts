/**
 * roleStore — CRUD for the role catalog stored in data/roles.json.
 *
 * Mirrors the structural pattern of userStore.ts:
 *  - File-based persistence
 *  - Seeded with standard Swiss GLN role types on first access
 *  - All operations are async and return typed values
 */

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RoleCatalogEntry = {
  id:        string;
  code:      string;   // e.g. "GrpPra"
  display:   string;   // e.g. "Gruppenpraxis"
  system?:   string;   // e.g. "urn:oid:2.51.1.3.roleType"
  createdAt: string;
};

// ── File setup ────────────────────────────────────────────────────────────────

const dataDir   = path.join(process.cwd(), "data");
const rolesFile = path.join(dataDir, "roles.json");

const SEED_ROLES: Omit<RoleCatalogEntry, "id" | "createdAt">[] = [
  { code: "GrpPra",  display: "Gruppenpraxis",            system: "urn:oid:2.51.1.3.roleType" },
  { code: "Labo",    display: "Labor",                    system: "urn:oid:2.51.1.3.roleType" },
  { code: "PubHea",  display: "Öffentliche Gesundheit",   system: "urn:oid:2.51.1.3.roleType" },
  { code: "Pharm",   display: "Apotheke",                 system: "urn:oid:2.51.1.3.roleType" },
  { code: "Spita",   display: "Spital",                   system: "urn:oid:2.51.1.3.roleType" },
  { code: "DocPra",  display: "Arztpraxis",               system: "urn:oid:2.51.1.3.roleType" },
  { code: "NotOrg",  display: "Notfallorganisation",      system: "urn:oid:2.51.1.3.roleType" },
  { code: "Reha",    display: "Rehabilitationszentrum",   system: "urn:oid:2.51.1.3.roleType" },
  { code: "PrivatDoc", display: "Privatarzt",             system: "urn:oid:2.51.1.3.roleType" },
];

async function ensureDataFile(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(rolesFile);
  } catch {
    // First run — seed with standard Swiss GLN role types
    const now   = new Date().toISOString();
    const roles: RoleCatalogEntry[] = SEED_ROLES.map((r) => ({
      ...r,
      id:        crypto.randomUUID(),
      createdAt: now,
    }));
    await fs.writeFile(rolesFile, JSON.stringify({ roles }, null, 2), "utf8");
  }
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export async function getRoles(): Promise<RoleCatalogEntry[]> {
  await ensureDataFile();
  const raw = await fs.readFile(rolesFile, "utf8");
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data.roles) ? (data.roles as RoleCatalogEntry[]) : [];
  } catch {
    return [];
  }
}

export async function getRoleById(id: string): Promise<RoleCatalogEntry | undefined> {
  const roles = await getRoles();
  return roles.find((r) => r.id === id);
}

// ── Writes ────────────────────────────────────────────────────────────────────

export async function createRole(input: {
  code:     string;
  display:  string;
  system?:  string;
}): Promise<RoleCatalogEntry> {
  await ensureDataFile();
  const roles = await getRoles();

  if (!input.code.trim())    throw new Error("Role code is required");
  if (!input.display.trim()) throw new Error("Role display name is required");

  if (roles.some((r) => r.code.toLowerCase() === input.code.trim().toLowerCase())) {
    throw new Error("Role code already exists");
  }

  const role: RoleCatalogEntry = {
    id:        crypto.randomUUID(),
    code:      input.code.trim(),
    display:   input.display.trim(),
    createdAt: new Date().toISOString(),
    ...(input.system?.trim() ? { system: input.system.trim() } : {}),
  };

  roles.push(role);
  await fs.writeFile(rolesFile, JSON.stringify({ roles }, null, 2), "utf8");
  return role;
}

export async function updateRole(
  id:    string,
  patch: { code?: string; display?: string; system?: string },
): Promise<RoleCatalogEntry> {
  const roles = await getRoles();
  const idx   = roles.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error("Role not found");

  const existing = roles[idx]!;

  // Duplicate code check — skip if the code didn't change
  if (patch.code !== undefined) {
    const newCode = patch.code.trim().toLowerCase();
    if (newCode !== existing.code.toLowerCase()) {
      if (roles.some((r) => r.id !== id && r.code.toLowerCase() === newCode)) {
        throw new Error("Role code already exists");
      }
    }
  }

  const updated: RoleCatalogEntry = {
    ...existing,
    ...(patch.code    !== undefined ? { code:    patch.code.trim()    } : {}),
    ...(patch.display !== undefined ? { display: patch.display.trim() } : {}),
  };

  // system: empty string means "remove the field"; undefined means "leave unchanged"
  if (patch.system !== undefined) {
    if (patch.system.trim()) {
      updated.system = patch.system.trim();
    } else {
      delete updated.system;
    }
  }

  roles[idx] = updated;
  await fs.writeFile(rolesFile, JSON.stringify({ roles }, null, 2), "utf8");
  return updated;
}

export async function deleteRole(id: string): Promise<void> {
  const roles = await getRoles();
  const idx   = roles.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error("Role not found");
  roles.splice(idx, 1);
  await fs.writeFile(rolesFile, JSON.stringify({ roles }, null, 2), "utf8");
}
