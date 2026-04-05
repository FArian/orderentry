import type { GlnLookupResult } from "@/domain/entities/GlnLookupResult";

/**
 * Adapter interface for shaping a GlnLookupResult into a versioned API response.
 *
 * Each API version has its own implementation. Business logic lives in the
 * domain; only the response shape differs between versions.
 */
export interface IGlnAdapter<TResponse> {
  adapt(result: GlnLookupResult): TResponse;
}
