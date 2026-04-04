/**
 * migrate-users-json-cli.ts
 *
 * CLI entry point — run via scripts/migrate-users-json.mjs (tsx).
 * Imports all users from data/users.json into the configured DB.
 * Idempotent: existing usernames are skipped.
 */

import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

const usersJsonPath: string = process.argv[2] ?? "";
if (!usersJsonPath) {
  console.error("[migrate] Usage: migrate-users-json-cli.ts <path-to-users.json>");
  process.exit(1);
}

type JsonUser = {
  id:                      string;
  username:                string;
  passwordHash:            string;
  salt:                    string;
  createdAt?:              string;
  role?:                   string;
  status?:                 string;
  providerType?:           string;
  externalId?:             string;
  fhirSyncStatus?:         string;
  fhirSyncedAt?:           string;
  fhirSyncError?:          string;
  fhirPractitionerId?:     string;
  fhirPractitionerRoleId?: string;
  apiTokenHash?:           string;
  apiTokenCreatedAt?:      string;
  profile?:                Record<string, unknown>;
};

async function run(): Promise<void> {
  const raw   = JSON.parse(readFileSync(usersJsonPath, "utf8")) as { users: JsonUser[] };
  const users = raw.users ?? [];

  const prisma = new PrismaClient();

  let imported = 0;
  let skipped  = 0;

  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { username: u.username.toLowerCase() } });
    if (existing) {
      console.log(`[migrate] Skipped (already exists): ${u.username}`);
      skipped++;
      continue;
    }

    await prisma.user.create({
      data: {
        id:                     u.id,
        username:               u.username.toLowerCase(),
        passwordHash:           u.passwordHash,
        salt:                   u.salt,
        createdAt:              u.createdAt ? new Date(u.createdAt) : new Date(),
        role:                   u.role                   ?? "user",
        status:                 u.status                 ?? "active",
        providerType:           u.providerType           ?? "local",
        externalId:             u.externalId             ?? null,
        fhirSyncStatus:         u.fhirSyncStatus         ?? "not_synced",
        fhirSyncedAt:           u.fhirSyncedAt           ? new Date(u.fhirSyncedAt) : null,
        fhirSyncError:          u.fhirSyncError          ?? null,
        fhirPractitionerId:     u.fhirPractitionerId     ?? null,
        fhirPractitionerRoleId: u.fhirPractitionerRoleId ?? null,
        apiTokenHash:           u.apiTokenHash           ?? null,
        apiTokenCreatedAt:      u.apiTokenCreatedAt      ? new Date(u.apiTokenCreatedAt) : null,
        profile:                u.profile ? JSON.stringify(u.profile) : null,
      },
    });

    console.log(`[migrate] Imported: ${u.username} (${u.role ?? "user"})`);
    imported++;
  }

  await prisma.$disconnect();
  console.log(`\n[migrate] Done — ${imported} imported, ${skipped} skipped.`);
}

run().catch((err) => {
  console.error("[migrate] Error:", err);
  process.exit(1);
});
