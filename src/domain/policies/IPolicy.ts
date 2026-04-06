/**
 * IPolicy — contract for permission evaluation.
 *
 * PolicyContext carries the caller's identity so that a policy implementation
 * can make purely functional decisions without side effects.
 */

import type { Permission } from "../valueObjects/Permission";

export interface PolicyContext {
  readonly role: string;
}

export interface IPolicy {
  /** Returns true when the given permission is granted in this context. */
  isGranted(context: PolicyContext, permission: Permission): boolean;
}
