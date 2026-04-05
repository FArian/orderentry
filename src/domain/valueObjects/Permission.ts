/**
 * Permission — fine-grained action constants for the RBAC system.
 *
 * Phase 1: role → permission mapping in code (no database, no Keycloak).
 * Phase 2 (future): permissions stored in DB, managed via Keycloak.
 *
 * Convention: "<resource>:<action>" — always lowercase, colon separator.
 */

export const PERMISSIONS = {
  // ── Orders ─────────────────────────────────────────────────────────────────
  ORDER_CREATE: "order:create",
  ORDER_READ:   "order:read",
  ORDER_EDIT:   "order:edit",

  // ── Patients ───────────────────────────────────────────────────────────────
  PATIENT_READ: "patient:read",
  PATIENT_EDIT: "patient:edit",

  // ── GLN ────────────────────────────────────────────────────────────────────
  GLN_READ: "gln:read",
  GLN_SYNC: "gln:sync",

  // ── Organizations ──────────────────────────────────────────────────────────
  ORG_READ:   "organization:read",
  ORG_DELETE: "organization:delete",

  // ── Users / Admin ──────────────────────────────────────────────────────────
  USER_MANAGE:  "user:manage",
  ADMIN_ACCESS: "admin:access",
} as const;

/** Union type of all valid permission strings. */
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
