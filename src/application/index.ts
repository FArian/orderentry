/**
 * @z2lab/application — Public API of the application layer.
 *
 * Re-exports all public application elements: use cases, services,
 * repository interfaces, service interfaces, adapters, strategies, and DTOs.
 */

// ── Use Cases ─────────────────────────────────────────────────────────────────

export { GetResults }                                     from "./useCases/GetResults";
export { SearchResults }                                  from "./useCases/SearchResults";
export { GetOrders }                                      from "./useCases/GetOrders";
export { CreateOrder }                                    from "./useCases/CreateOrder";
export { checkPermission }                                from "./useCases/CheckPermission";
export { GenerateOrderNumberUseCase,
         OrderBlockedError }                              from "./useCases/GenerateOrderNumberUseCase";
export type { GenerateOrderNumberInput,
              GenerateOrderNumberResult }                 from "./useCases/GenerateOrderNumberUseCase";
export { ReserveOrderNumberUseCase }                      from "./useCases/ReserveOrderNumberUseCase";
export type { ReserveNumbersInput,
              ReserveNumbersResult }                      from "./useCases/ReserveOrderNumberUseCase";

// ── Services ──────────────────────────────────────────────────────────────────

export { OrderService }                                   from "./services/OrderService";
export { ResultService }                                  from "./services/ResultService";
export { FhirAccessResolver }                             from "./services/FhirAccessResolver";
export type { FhirAccessResolverOptions }                 from "./services/FhirAccessResolver";
export { resolveOrganizations,
         resolveSenderFromPatient }                        from "./services/OrganizationResolver";
export type { ResolvedOrganizations }                     from "./services/OrganizationResolver";

// ── Repository Interfaces ─────────────────────────────────────────────────────

export type { IResultRepository,
              ResultSearchQuery,
              PagedResults }                              from "./interfaces/repositories/IResultRepository";
export type { IOrderRepository,
              OrderSearchQuery,
              PagedOrders }                               from "./interfaces/repositories/IOrderRepository";
export type { IUserRepository }                           from "./interfaces/repositories/IUserRepository";
export type { IOrgRuleRepository }                        from "./interfaces/repositories/IOrgRuleRepository";
export type { IReservedNumberRepository,
              PoolStats }                                 from "./interfaces/repositories/IReservedNumberRepository";
export type { IAdminTaskRepository }                      from "./interfaces/repositories/IAdminTaskRepository";
export type { IAgentJobRepository,
              CreateAgentJobInput }                       from "./interfaces/repositories/IAgentJobRepository";
export type { IAgentRegistrationRepository,
              AgentRegistrationData,
              CreateAgentRegistrationInput }              from "./interfaces/repositories/IAgentRegistrationRepository";

// ── Service Interfaces ────────────────────────────────────────────────────────

export type { IOrchestraOrderService,
              OrchestraOrderNumberResult }                from "./interfaces/services/IOrchestraOrderService";
export type { IPoolNotificationService }                  from "./interfaces/services/IPoolNotificationService";
export type { IMailService,
              MailVerifyResult }                          from "./interfaces/IMailService";
export type { IDeepLinkAuthStrategy,
              DeepLinkAuthResult,
              DeepLinkAuthError }                         from "./interfaces/IDeepLinkAuthStrategy";

// ── Adapters ──────────────────────────────────────────────────────────────────

export type { IGlnAdapter }                               from "./adapters/IGlnAdapter";
export { GlnAdapterV1, glnAdapterV1 }                    from "./adapters/GlnAdapterV1";
export { GlnAdapterV2, glnAdapterV2 }                    from "./adapters/GlnAdapterV2";

// ── DTOs ──────────────────────────────────────────────────────────────────────

export type { GlnResponseV1,
              GlnResponseV2,
              GlnPersonV2,
              GlnAddressV2 }                              from "./dto/GlnDto";

// ── Strategies ────────────────────────────────────────────────────────────────

export { PatientIdStrategy,
         PatientNameStrategy,
         PatientSearchStrategySelector,
         patientSearchSelector }                          from "./strategies/PatientSearchStrategy";
export type { PatientSearchParams,
              IPatientSearchStrategy }                    from "./strategies/PatientSearchStrategy";
