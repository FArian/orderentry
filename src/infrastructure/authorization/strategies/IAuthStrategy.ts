/**
 * Contract for all outbound authentication strategies.
 *
 * Each strategy produces the artefacts needed to authenticate a single
 * outgoing HTTP request: headers to merge and/or query params to append.
 * The caller is responsible for merging these into the actual fetch call.
 */

/** Artefacts produced by a strategy for a single request. */
export interface AuthResult {
  /** HTTP headers to merge into the request (e.g. { Authorization: "Bearer …" }). */
  readonly headers: Record<string, string>;
  /** Query params to append to the request URL (e.g. { api_key: "…" }). */
  readonly searchParams: Record<string, string>;
}

export interface IAuthStrategy {
  /**
   * Produce auth artefacts for one outgoing request.
   *
   * @param url    Full request URL — needed by Digest to hash the URI path.
   * @param method HTTP method (GET, POST, …) — needed by Digest.
   * @returns      Headers and/or searchParams to attach to the request.
   *
   * May be async (OAuth2 needs to fetch/refresh a token from a token endpoint).
   * For all other strategies the promise resolves synchronously.
   */
  apply(url: string, method: string): Promise<AuthResult>;
}
