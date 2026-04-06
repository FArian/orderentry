/**
 * Versioned response shapes for GET /api/gln-lookup and GET /api/v2/gln-lookup.
 *
 * Types are defined in the application layer — re-exported here so infrastructure
 * callers (controllers, routes) do not need to change their import paths.
 */

export type {
  GlnResponseV1,
  GlnPersonV2,
  GlnAddressV2,
  GlnResponseV2,
} from "@/application/dto/GlnDto";
