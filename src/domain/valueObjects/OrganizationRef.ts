/**
 * OrganizationRef — immutable reference to an organization resolved from FHIR.
 *
 * Carries the display name and an optional GLN identifier.
 * GLN is resolved lazily on the detail view — never fetched per-row in list views.
 *
 * Layer: domain (no framework, no API, no I/O).
 */

export interface OrganizationRef {
  /** Display name of the organization (never empty — use "" as sentinel). */
  name: string;
  /** GS1 Global Location Number, resolved from Organization.identifier. */
  gln?: string | undefined;
}

/** Sentinel value meaning "no organization resolved". */
export const EMPTY_ORG: OrganizationRef = { name: "" };

/** Returns true when the ref carries a non-empty name. */
export function hasOrg(ref: OrganizationRef | undefined): ref is OrganizationRef {
  return !!ref?.name;
}
