/**
 * OrderSubmitController — handles POST /api/orders/submit.
 *
 * Accepts a FHIR transaction bundle from the browser and forwards it
 * to the HAPI FHIR server using the server-side FhirClient.
 *
 * This removes the direct browser→FHIR call from OrderClient.tsx and routes
 * all FHIR writes through the Next.js server (Clean Architecture boundary).
 */

import { fhirTransaction } from "@/infrastructure/fhir/FhirClient";
import { createLogger, type Logger } from "@/infrastructure/logging/Logger";

interface FhirBundleEntry {
  response?: { location?: string };
}

interface FhirBundleResponse {
  resourceType: "Bundle";
  entry?: FhirBundleEntry[];
}

export interface SubmitBundleResponseDto {
  /** Resource locations returned by HAPI (e.g. "ServiceRequest/abc/_history/1") */
  ids: string[];
  httpStatus?: number;
  error?: string;
}

export class OrderSubmitController {
  private readonly log: Logger;

  constructor(logger?: Logger) {
    this.log = logger ?? createLogger("OrderSubmitController");
  }

  async submit(
    bundle: Record<string, unknown>,
  ): Promise<SubmitBundleResponseDto> {
    this.log.info("Submitting FHIR transaction bundle");

    if (bundle.resourceType !== "Bundle" || bundle.type !== "transaction") {
      this.log.warn("Invalid bundle received", {
        resourceType: String(bundle.resourceType ?? ""),
        type: String(bundle.type ?? ""),
      });
      return {
        ids: [],
        error: "Payload must be a FHIR transaction Bundle",
        httpStatus: 400,
      };
    }

    try {
      const resp = await fhirTransaction<FhirBundleResponse>(bundle);

      const ids = (resp.entry ?? [])
        .map((e) => e.response?.location)
        .filter((v): v is string => typeof v === "string");

      this.log.info("FHIR transaction completed", { idCount: ids.length });
      return { ids };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error("FHIR transaction failed", { message });
      return { ids: [], error: message, httpStatus: 502 };
    }
  }
}

export const orderSubmitController = new OrderSubmitController();
