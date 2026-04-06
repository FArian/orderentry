// Domain entity — org-specific rules for order numbers, patient IDs, and HL7 mapping.
// No framework dependencies. Pure data shape + factory.

import type { ServiceType } from "../strategies/IOrderNumberStrategy";

export interface OrgRule {
  id:            string;
  orgFhirId:     string;
  orgGln:        string;
  orgName:       string;

  /** Prefix prepended to patient identifiers for this org. e.g. "HI" for Hirslanden. */
  patientPrefix: string;

  /** Prefix prepended to case/Fallnummer for this org. */
  casePrefix:    string;

  /** HL7 MSH-3 Sending Application */
  hl7Msh3:       string;

  /** HL7 MSH-4 Sending Facility */
  hl7Msh4:       string;

  /** HL7 MSH-5 Receiving Application */
  hl7Msh5:       string;

  /** HL7 MSH-6 Receiving Facility */
  hl7Msh6:       string;

  // ── Per-org order number overrides (empty string / null = use global ENV defaults) ──

  /** MIBI order number prefix override. Empty = use global ORDER_MI_PREFIX. */
  mibiPrefix:    string;

  /** MIBI start digit after prefix override. Empty = use global ORDER_MI_START. */
  mibiStart:     string;

  /** MIBI total number length including prefix. null = use global ORDER_MI_LENGTH. */
  mibiLength:    number | null;

  /** POC order number prefix override. Empty = use global ORDER_POC_PREFIX. */
  pocPrefix:     string;

  /** POC total number length including prefix. null = use global ORDER_POC_LENGTH. */
  pocLength:     number | null;

  /** Routine total digit count. null = use global ORDER_ROUTINE_LENGTH. */
  routineLength: number | null;

  /**
   * JSON mapping: external department code → ServiceType.
   * Example: { "MIKRO": "MIBI", "CARDIO": "ROUTINE", "BGA": "POC" }
   * Parsed at runtime; stored as JSON string in DB.
   */
  serviceTypeMapping: Record<string, ServiceType>;

  createdAt:     string;
  updatedAt:     string;
}

export type OrgRuleInput = Omit<OrgRule, "id" | "createdAt" | "updatedAt">;

export const EMPTY_ORG_RULE: OrgRuleInput = {
  orgFhirId:          "",
  orgGln:             "",
  orgName:            "",
  patientPrefix:      "",
  casePrefix:         "",
  hl7Msh3:            "",
  hl7Msh4:            "",
  hl7Msh5:            "ZLZ",
  hl7Msh6:            "LAB",
  mibiPrefix:         "",
  mibiStart:          "",
  mibiLength:         null,
  pocPrefix:          "",
  pocLength:          null,
  routineLength:      null,
  serviceTypeMapping: {},
};
