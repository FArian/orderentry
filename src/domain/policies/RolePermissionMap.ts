/**
 * RolePermissionMap — declarative role → permission mapping (Phase 1).
 *
 * Rules:
 *   - "admin" receives ALL permissions (full system access)
 *   - "user"  receives a restricted set (clinician day-to-day operations)
 *   - Unknown roles receive NO permissions (deny-by-default)
 *
 * Phase 2 (TODO): replace this static map with DB-backed permission records
 * managed via the admin UI or Keycloak role mapper.
 */

import { PERMISSIONS }  from "../valueObjects/Permission";
import type { Permission } from "../valueObjects/Permission";

const ALL_PERMISSIONS = new Set<Permission>(
  Object.values(PERMISSIONS) as Permission[],
);

const USER_PERMISSIONS = new Set<Permission>([
  PERMISSIONS.ORDER_CREATE,
  PERMISSIONS.ORDER_READ,
  PERMISSIONS.PATIENT_READ,
  PERMISSIONS.GLN_READ,
  PERMISSIONS.ORG_READ,
]);

/**
 * Maps role name → set of granted permissions.
 * Roles not listed here are implicitly denied everything.
 */
export const ROLE_PERMISSION_MAP: Readonly<Record<string, ReadonlySet<Permission>>> = {
  admin: ALL_PERMISSIONS,
  user:  USER_PERMISSIONS,
};
