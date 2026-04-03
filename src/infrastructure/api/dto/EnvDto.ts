/**
 * Data Transfer Objects for the /api/env endpoint.
 *
 * Only whitelisted environment variables are exposed — secrets such as
 * AUTH_SECRET are never included.
 */

/** A single environment variable as returned / accepted by the API. */
export interface EnvVarDto {
  /** Environment variable name (e.g. "FHIR_BASE_URL"). */
  key: string;
  /** Current value as a string. Empty string means the variable is not set. */
  value: string;
}

/** Response body for GET /api/env */
export interface GetEnvResponseDto {
  vars: EnvVarDto[];
}

/** Request body for POST /api/env */
export interface UpdateEnvRequestDto {
  /**
   * Full list of variables to persist.
   * - A variable present here but absent in the file will be added.
   * - A variable absent here but present in the file will be removed
   *   (only for whitelisted keys).
   * - Non-whitelisted keys are never touched.
   */
  vars: EnvVarDto[];
}

/** A single ENV var entry in the schema catalog. */
export interface EnvSchemaEntryDto {
  key:             string;
  description:     string;
  default:         string;
  currentValue:    string; // masked as "••••••••" for secrets
  required:        boolean;
  writable:        boolean; // can be changed via POST /api/env
  restartRequired: boolean;
  secret:          boolean;
  group:           string;
}

/** Response body for GET /api/env/schema */
export interface EnvSchemaResponseDto {
  entries: EnvSchemaEntryDto[];
}

/** Response body for POST /api/env */
export interface UpdateEnvResponseDto {
  ok: boolean;
  /** Human-readable message (success or error description). */
  message: string;
  /** Internal: HTTP status code used by the route; stripped from the JSON body. */
  httpStatus?: number;
}
