"use client";

import { useCallback, useMemo } from "react";
import { ServiceFactory } from "@/infrastructure/ServiceFactory";

/**
 * useSubmitOrder — presentation-layer hook for submitting a lab order.
 *
 * Routes the FHIR transaction bundle through the Clean Architecture stack:
 *   useSubmitOrder → ServiceFactory → OrderService → FhirOrderRepository
 *     → POST /api/orders/submit (Next.js API route, server-side)
 *       → FhirClient.fhirTransaction → HAPI FHIR
 *
 * Replaces the direct fhirPost("/", bundle) call that was in OrderClient.tsx.
 *
 * Note: This hook does NOT manage submitting/error state — the legacy
 * OrderClient.tsx retains its own state for the migration period.
 * State management can be added here in a future step once the component
 * is further decoupled.
 */
export function useSubmitOrder() {
  const service = useMemo(() => ServiceFactory.orderService(), []);

  const submitBundle = useCallback(
    async (bundle: Record<string, unknown>): Promise<string[]> => {
      return service.submitBundle(bundle);
    },
    [service],
  );

  return { submitBundle };
}
