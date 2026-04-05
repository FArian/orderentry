/**
 * CheckPermission — pure use case: does a role have the requested permission?
 *
 * No I/O, no side effects — safe to call from any layer including tests.
 * The ROLE_PERMISSION_MAP is the single source of truth for Phase 1.
 */

import type { Permission }    from "@/domain/valueObjects/Permission";
import { ROLE_PERMISSION_MAP } from "@/domain/policies/RolePermissionMap";

/**
 * Returns true when the given role is granted the requested permission.
 * Unknown roles always return false (deny-by-default).
 */
export function checkPermission(role: string, permission: Permission): boolean {
  const grants = ROLE_PERMISSION_MAP[role];
  if (!grants) return false;
  return grants.has(permission);
}
