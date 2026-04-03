/**
 * DeepLinkContext — value object carrying the validated context of a deep-link request.
 *
 * Produced by the deep-link auth strategy after successful token validation.
 * Consumed by DeepLinkService to load FHIR resources and build the redirect URL.
 */

/** Type of clinical context that triggered the deep link. */
export type DeepLinkContextType =
  | "order-entry"   // open order creation for a patient
  | "patient"       // open patient record
  | "results";      // open results for a patient

/** Validated, immutable context extracted from a deep-link token. */
export interface DeepLinkContext {
  /** FHIR Patient resource ID, e.g. "Patient/p-123" or bare "p-123". */
  readonly patientId: string;
  /** FHIR Encounter resource ID (optional — billing/TARDOC context). */
  readonly encounterId?: string;
  /** FHIR Coverage resource ID (optional — insurance context). */
  readonly coverageId?: string;
  /** Which workflow to launch in OrderEntry. */
  readonly contextType: DeepLinkContextType;
  /** Identifier of the source system (KIS/PIS) that generated the link. */
  readonly sourceSystem: string;
  /** Token JWT ID (jti) — used for nonce/replay protection. */
  readonly nonce: string;
  /** Unix seconds when this context was created (from token iat). */
  readonly requestedAt: number;
}
