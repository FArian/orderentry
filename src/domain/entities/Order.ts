// Domain entity — framework-independent, no React, no API calls.

import type { OrganizationRef } from "../valueObjects/OrganizationRef";

export enum OrderStatus {
  DRAFT            = "draft",
  ACTIVE           = "active",
  ON_HOLD          = "on-hold",
  COMPLETED        = "completed",
  /** FHIR wire value is "revoked" */
  CANCELLED        = "revoked",
  ENTERED_IN_ERROR = "entered-in-error",
  UNKNOWN          = "unknown",
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  intent: string;
  patientId: string;
  authoredOn: string;
  codeText: string;
  specimenCount: number;
  /** Sending organization (Auftraggeber). Resolved from ServiceRequest.requester. */
  sender?: OrganizationRef | undefined;
  /** Receiving organizations (Auftragnehmer). Resolved from ServiceRequest.performer[]. */
  receivers: OrganizationRef[];
}
