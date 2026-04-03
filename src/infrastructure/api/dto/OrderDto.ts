/**
 * Data Transfer Objects for the /api/service-requests endpoint.
 */

/** Query parameters accepted by GET /api/service-requests */
export interface ListOrdersQueryDto {
  /** FHIR Organization ID — restricts results to patients of this org */
  orgFhirId?: string;
  /** Organization GLN — fallback when orgFhirId not yet resolved */
  orgGln?: string;
}

/** A single ServiceRequest (order) as returned by the API */
export interface OrderResponseDto {
  id: string;
  status: string;
  intent: string;
  codeText: string;
  authoredOn: string;
  orderNumber: string;
  specimenCount: number;
  patientId: string;
}

/** Response for GET /api/service-requests */
export interface ListOrdersResponseDto {
  data: OrderResponseDto[];
  total: number;
  /** Present only on error responses */
  error?: string;
  /** Internal: HTTP status to use in the route response */
  httpStatus?: number;
}

/** Response for DELETE /api/service-requests/{id} */
export interface DeleteOrderResponseDto {
  /** Whether the resource was removed (hard or soft) */
  deleted: boolean;
  /** true when a hard DELETE was not possible and status was set to entered-in-error */
  soft?: boolean;
  /** Present only on error responses */
  error?: string;
  /** Internal: HTTP status to use in the route response */
  httpStatus?: number;
}
