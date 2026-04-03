/**
 * BearerAuthGuard — resolves an Authorization: Bearer header to a user session.
 *
 * Supports two token types detected by prefix:
 *   ztk_...  → Personal Access Token (PAT): hash-lookup in users.json
 *   eyJ...   → JWT (HS256): stateless signature verification
 *
 * Usage (in API routes):
 *   const session = await bearerAuthGuard.resolve(req.headers.get("authorization"));
 *   if (!session || session.role !== "admin") return 401/403
 */

import { getUsers } from "@/lib/userStore";
import { apiTokenService, ApiTokenService } from "./ApiTokenService";
import { userJwtService } from "./UserJwtService";

export type BearerSession = {
  sub:      string;
  username: string;
  role:     string;
};

export class BearerAuthGuard {
  /**
   * Resolves the Authorization header value to a BearerSession.
   * Returns null when the header is absent, malformed, or the token is invalid.
   */
  async resolve(authHeader: string | null | undefined): Promise<BearerSession | null> {
    if (!authHeader?.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7).trim();
    if (!token) return null;

    return ApiTokenService.isPat(token)
      ? this.resolvePat(token)
      : this.resolveJwt(token);
  }

  // ── PAT: full user-list scan with timing-safe comparison ───────────────────

  private async resolvePat(token: string): Promise<BearerSession | null> {
    const users = await getUsers();
    for (const user of users) {
      if (!user.apiTokenHash) continue;
      if (apiTokenService.verify(token, user.apiTokenHash)) {
        if (user.status && user.status !== "active") return null;
        return { sub: user.id, username: user.username, role: user.role ?? "user" };
      }
    }
    return null;
  }

  // ── JWT: stateless verification ────────────────────────────────────────────

  private resolveJwt(token: string): BearerSession | null {
    const payload = userJwtService.verify(token);
    if (!payload) return null;
    return { sub: payload.sub, username: payload.username, role: payload.role };
  }
}

export const bearerAuthGuard = new BearerAuthGuard();
