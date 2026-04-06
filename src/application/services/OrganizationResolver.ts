/**
 * OrganizationResolver — resolves sender / receiver organizations from FHIR data.
 *
 * Priority rules (per architecture decision):
 *   sender   = ServiceRequest.requester.display
 *              || Patient.managingOrganization.display
 *   receiver = ServiceRequest.performer[0].display
 *              || AppConfig.labOrgId (display name only — no extra FHIR fetch in lists)
 *
 * This is a pure function module — no I/O, no framework dependencies.
 * Layer: application (may reference domain, may NOT reference infrastructure).
 */

import type { OrganizationRef } from "@/domain/valueObjects/OrganizationRef";

// ── Minimal FHIR shapes accepted by this resolver ─────────────────────────────

interface FhirReference {
  reference?: string;
  display?: string;
}

interface ResolvableServiceRequest {
  requester?: FhirReference | undefined;
  performer?: FhirReference[] | undefined;
}

interface ResolvablePatient {
  managingOrganization?: FhirReference;
}

// ── Result ────────────────────────────────────────────────────────────────────

export interface ResolvedOrganizations {
  sender?: OrganizationRef | undefined;
  receivers: OrganizationRef[];
}

// ── Resolver ──────────────────────────────────────────────────────────────────

/**
 * Resolves sender and receiver organizations from a FHIR ServiceRequest + Patient.
 *
 * @param sr   - Partial FHIR ServiceRequest (requester, performer)
 * @param patient - Partial FHIR Patient (managingOrganization) — used as sender fallback
 * @param labFallbackName - Display name of the lab used when performer is absent
 */
export function resolveOrganizations(
  sr: ResolvableServiceRequest,
  patient: ResolvablePatient,
  labFallbackName: string,
): ResolvedOrganizations {
  // ── Sender ────────────────────────────────────────────────────────────────
  const senderDisplay =
    sr.requester?.display ||
    patient.managingOrganization?.display ||
    "";

  const sender: OrganizationRef | undefined = senderDisplay
    ? { name: senderDisplay }
    : undefined;

  // ── Receivers ─────────────────────────────────────────────────────────────
  const rawPerformers = Array.isArray(sr.performer) ? sr.performer : [];
  const performers: OrganizationRef[] = rawPerformers
    .filter((p) => !!p.display)
    .map((p) => ({ name: p.display! }));

  const receivers: OrganizationRef[] =
    performers.length > 0
      ? performers
      : labFallbackName
      ? [{ name: labFallbackName }]
      : [];

  return {
    ...(sender !== undefined && { sender }),
    receivers,
  };
}

/**
 * Resolves sender from Patient.managingOrganization only (no ServiceRequest needed).
 * Used in patient list rows where no SR is available.
 */
export function resolveSenderFromPatient(patient: ResolvablePatient): OrganizationRef | undefined {
  const display = patient.managingOrganization?.display || "";
  return display ? { name: display } : undefined;
}
