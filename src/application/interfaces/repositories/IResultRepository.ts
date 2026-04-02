import type { Result } from "@/domain/entities/Result";

export interface ResultSearchQuery {
  /** Free-text search mapped to FHIR code param */
  q?: string;
  status?: string;
  patientId?: string;
  patientName?: string;
  /** ZLZ order number (searches via FHIR based-on.identifier) */
  orderNumber?: string;
  page?: number;
  pageSize?: number;
}

export interface PagedResults {
  data: Result[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IResultRepository {
  search(query: ResultSearchQuery): Promise<PagedResults>;
  getById(id: string): Promise<Result | null>;
}
