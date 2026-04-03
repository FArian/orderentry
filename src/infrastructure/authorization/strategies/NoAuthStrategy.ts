import type { IAuthStrategy, AuthResult } from "./IAuthStrategy";

const EMPTY: AuthResult = Object.freeze({ headers: {}, searchParams: {} });

/**
 * Pass-through strategy — attaches no authentication artefacts.
 * Default for services that run on a trusted internal network (e.g. HAPI FHIR
 * behind Traefik with no exposed public port).
 */
export class NoAuthStrategy implements IAuthStrategy {
  async apply(_url: string, _method: string): Promise<AuthResult> {
    return EMPTY;
  }
}
