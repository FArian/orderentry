/**
 * ServiceFactory — lightweight dependency injection.
 *
 * Centralises the wiring of infrastructure implementations to application
 * services so that hooks/pages never instantiate repositories directly.
 *
 * Design patterns: Factory + Dependency Injection
 *
 * Usage:
 *   const resultService = ServiceFactory.resultService();
 *   const orderService  = ServiceFactory.orderService();
 *
 * For testing: swap the repository by calling the factory with a mock:
 *   ServiceFactory.resultService(new MockResultRepository())
 */

import { ResultService } from "@/application/services/ResultService";
import { OrderService } from "@/application/services/OrderService";
import { FhirResultRepository } from "@/infrastructure/repositories/FhirResultRepository";
import { FhirOrderRepository } from "@/infrastructure/repositories/FhirOrderRepository";
import type { IResultRepository } from "@/application/interfaces/repositories/IResultRepository";
import type { IOrderRepository } from "@/application/interfaces/repositories/IOrderRepository";

export class ServiceFactory {
  /**
   * Returns a ResultService backed by the FHIR API (default) or a custom
   * repository supplied by the caller (useful for tests).
   */
  static resultService(repo?: IResultRepository): ResultService {
    return new ResultService(repo ?? new FhirResultRepository());
  }

  /**
   * Returns an OrderService backed by the FHIR API (default) or a custom
   * repository supplied by the caller.
   */
  static orderService(repo?: IOrderRepository): OrderService {
    return new OrderService(repo ?? new FhirOrderRepository());
  }
}
