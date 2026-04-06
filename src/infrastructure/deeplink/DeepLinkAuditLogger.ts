/**
 * DeepLinkAuditLogger — structured audit log for every deep-link request.
 *
 * Each event is emitted as a structured INFO log line via the infrastructure
 * Logger so it lands in the persistent log file alongside all other events.
 * Audit fields are always present even when the request is rejected, making
 * it easy to detect brute-force or replay attacks in log analysis.
 */

import { createLogger } from "../logging/Logger";
import type { DeepLinkContext } from "@/domain/entities/DeepLinkContext";
import type { DeepLinkAuthError } from "@/application/interfaces/IDeepLinkAuthStrategy";

const logger = createLogger("DeepLinkAudit");

export interface DeepLinkAuditEvent {
  /** Outcome of the deep-link request. */
  outcome:      "success" | "auth_failure" | "fhir_error" | "disabled";
  /** Source IP address from the request (best-effort). Omit if unknown. */
  sourceIp?:    string | undefined;
  /** User-Agent header from the request (best-effort). Omit if unknown. */
  userAgent?:   string | undefined;
  /** Validated context, present on success. */
  context?:     DeepLinkContext | undefined;
  /** Auth error, present on auth_failure. */
  authError?:   DeepLinkAuthError | undefined;
  /** Additional detail message. */
  detail?:      string | undefined;
}

export function auditDeepLink(event: DeepLinkAuditEvent): void {
  if (event.outcome === "success") {
    logger.info("deep_link_success", {
      patientId:    event.context?.patientId,
      sourceSystem: event.context?.sourceSystem,
      contextType:  event.context?.contextType,
      encounterId:  event.context?.encounterId,
      nonce:        event.context?.nonce,
      sourceIp:     event.sourceIp,
      userAgent:    event.userAgent,
    });
    return;
  }

  if (event.outcome === "auth_failure") {
    logger.warn("deep_link_auth_failure", {
      errorCode:  event.authError?.code,
      errorMsg:   event.authError?.message,
      sourceIp:   event.sourceIp,
      userAgent:  event.userAgent,
    });
    return;
  }

  if (event.outcome === "fhir_error") {
    logger.error("deep_link_fhir_error", { detail: event.detail, sourceIp: event.sourceIp });
    return;
  }

  logger.info("deep_link_disabled", { sourceIp: event.sourceIp });
}
