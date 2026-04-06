/**
 * @z2lab/domain — Public API of the domain layer.
 *
 * Re-exports all public domain elements: entities, value objects,
 * factories, strategies, and policies.
 *
 * ⚠️  PREPARATION NOTE
 * The copied source files still use `@/domain/...` path aliases internally.
 * Before this package is actively consumed by the frontend or BFF, those
 * internal aliases must be rewritten to relative imports and the monorepo
 * workspace must be configured (pnpm workspaces / Turborepo).
 * That is Phase 3 Step 3.5 work — do not consume this package yet.
 */

// ── Entities ─────────────────────────────────────────────────────────────────

export type { Patient }                                    from "./entities/Patient";
export type { Analysis }                                   from "./entities/Analysis";
export { ResultStatus }                                    from "./entities/Result";
export type { Result }                                     from "./entities/Result";
export { OrderStatus }                                     from "./entities/Order";
export type { Order }                                      from "./entities/Order";
export type { MailMessage }                                from "./entities/MailMessage";
export type { DeepLinkContextType, DeepLinkContext }       from "./entities/DeepLinkContext";
export type { AgentJobType, AgentJobStatus,
              AgentJobPayload, AgentJob }                  from "./entities/AgentJob";
export type { UserRole, UserStatus, UserProviderType,
              UserFhirSyncStatus, ManagedUserProfile,
              ManagedUser }                                from "./entities/ManagedUser";
export type { UserProfile, User }                         from "./entities/User";
export type { OrgRule, OrgRuleInput }                     from "./entities/OrgRule";
export {      EMPTY_ORG_RULE }                            from "./entities/OrgRule";
export type { ReservedNumberStatus, ReservedOrderNumber,
              ReservedNumberInput }                        from "./entities/ReservedOrderNumber";
export type { GlnLookupResult }                           from "./entities/GlnLookupResult";
export type { AdminTaskType, AdminTaskSeverity,
              AdminTaskStatus, AdminTask,
              AdminTaskInput }                            from "./entities/AdminTask";

// ── Value Objects ─────────────────────────────────────────────────────────────

export { OrderNumber }                                    from "./valueObjects/OrderNumber";
export { Identifier }                                     from "./valueObjects/Identifier";
export { PERMISSIONS, ASSIGNABLE_PERMISSIONS }            from "./valueObjects/Permission";
export type { Permission }                                from "./valueObjects/Permission";
export { PoolThreshold }                                  from "./valueObjects/PoolThreshold";
export type { AlertLevel, PoolThresholdData }             from "./valueObjects/PoolThreshold";
export { ACCESS_LEVELS,
         INTERNAL_ROLE_CODES_DEFAULT,
         ORG_ADMIN_ROLE_CODES_DEFAULT,
         PHYSICIAN_ROLE_CODES_DEFAULT,
         INTERNAL_ROLE_CODES,
         ORG_ADMIN_ROLE_CODES,
         PHYSICIAN_ROLE_CODES }                           from "./valueObjects/AccessLevel";
export type { AccessLevelType, AccessLevelInfo }          from "./valueObjects/AccessLevel";
export { EMPTY_ORG, hasOrg }                              from "./valueObjects/OrganizationRef";
export type { OrganizationRef }                           from "./valueObjects/OrganizationRef";

// ── Factories ─────────────────────────────────────────────────────────────────

export { ResultFactory }                                  from "./factories/ResultFactory";
export { OrderFactory }                                   from "./factories/OrderFactory";

// ── Strategies ────────────────────────────────────────────────────────────────

export { SERVICE_TYPES, isKnownServiceType, isServiceType } from "./strategies/IOrderNumberStrategy";
export type { KnownServiceType, ServiceType,
              IOrderNumberStrategy }                      from "./strategies/IOrderNumberStrategy";
export { MibiStrategy }                                   from "./strategies/MibiStrategy";
export { RoutineStrategy }                                from "./strategies/RoutineStrategy";
export { PocStrategy }                                    from "./strategies/PocStrategy";
export { PassthroughStrategy }                            from "./strategies/PassthroughStrategy";
export { orderNumberStrategyRegistry }                    from "./strategies/OrderNumberStrategyRegistry";
export type { StrategyConfig }                            from "./strategies/OrderNumberStrategyRegistry";

// ── Policies ──────────────────────────────────────────────────────────────────

export type { PolicyContext, IPolicy }                    from "./policies/IPolicy";
export { ROLE_PERMISSION_MAP }                            from "./policies/RolePermissionMap";
