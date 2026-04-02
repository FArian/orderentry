// Domain entity — framework-independent, no React, no API calls.

export type OrderStatus =
  | "draft"
  | "active"
  | "on-hold"
  | "completed"
  | "revoked"
  | "entered-in-error"
  | "unknown";

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  intent: string;
  patientId: string;
  authoredOn: string;
  codeText: string;
  specimenCount: number;
}
