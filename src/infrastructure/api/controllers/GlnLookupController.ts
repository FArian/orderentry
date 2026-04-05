import type { IGlnAdapter }    from "@/application/adapters/IGlnAdapter";
import type { GlnLookupResult } from "@/domain/entities/GlnLookupResult";
import { RefDataSoapClient, GlnNotFoundError, GlnLookupError } from "@/infrastructure/gln/RefDataSoapClient";
import { createLogger }         from "@/infrastructure/logging/Logger";

const log = createLogger("GlnLookupController");

export type GlnLookupResponse<T> =
  | { ok: true;  data: T }
  | { ok: false; status: number; error: string };

/**
 * Shared GLN lookup controller. Version-agnostic — returns GlnLookupResult.
 * Routes inject an IGlnAdapter to shape the response for their specific version.
 *
 * Constructor injection of endpointUrl and fetchFn enables unit testing
 * without network access (same pattern as other controllers in this project).
 */
export class GlnLookupController {
  private readonly client: RefDataSoapClient;

  constructor(endpointUrl: string, fetchFn: typeof fetch = fetch) {
    this.client = new RefDataSoapClient(endpointUrl, 5000, fetchFn);
  }

  async lookup<T>(
    gln: string,
    apiVersion: string,
    adapter: IGlnAdapter<T>,
  ): Promise<GlnLookupResponse<T>> {
    if (!/^\d{13}$/.test(gln)) {
      return { ok: false, status: 400, error: "invalidGln" };
    }

    log.debug(`API ${apiVersion} → /gln-lookup`, { gln });

    try {
      const result: GlnLookupResult = await this.client.lookup(gln);
      return { ok: true, data: adapter.adapt(result) };
    } catch (err: unknown) {
      if (err instanceof GlnNotFoundError) {
        return { ok: false, status: 404, error: "glnNotFound" };
      }
      if (err instanceof GlnLookupError) {
        log.error(`API ${apiVersion} GLN lookup failed`, { gln, message: err.message });
        return { ok: false, status: 502, error: "glnUnavailable" };
      }
      const message = err instanceof Error ? err.message : "Lookup failed";
      log.error(`API ${apiVersion} unexpected error`, { gln, message });
      return { ok: false, status: 500, error: "glnError" };
    }
  }
}
