/**
 * RequirePermission — HTTP-layer permission guard.
 *
 * Resolves the caller identity (Bearer token → cookie session → anonymous)
 * and checks the requested permission via CheckPermission.
 *
 * Returns a discriminated union so route handlers can destructure cleanly:
 *
 *   const perm = await requirePermission(req, PERMISSIONS.GLN_READ);
 *   if (!perm.ok) return perm.response;
 *   // perm.role, perm.sub, perm.username are now available
 *
 * Error responses follow RFC 7807 Problem Details for consistency with
 * ApiGateway and the /api/launch endpoint.
 *
 * Server-only — never import from client components.
 */

import { NextResponse }         from "next/server";
import type { Permission }      from "@/domain/valueObjects/Permission";
import { checkPermission }      from "@/application/useCases/CheckPermission";
import { getSessionUserWithOrg } from "@/lib/auth";
import { createLogger }         from "@/infrastructure/logging/Logger";

const log = createLogger("RequirePermission");

// ── Result type ───────────────────────────────────────────────────────────────

export type PermissionResult =
  | { ok: true;  sub: string; username: string; role: string }
  | { ok: false; response: NextResponse };

// ── Guard ─────────────────────────────────────────────────────────────────────

/**
 * Resolves identity from Bearer token or session cookie, then checks permission.
 *
 * Priority:
 *   1. Authorization: Bearer header (PAT / JWT — external clients)
 *   2. Session cookie (browser / Swagger UI)
 *   3. No identity → 401
 */
export async function requirePermission(
  req:        Request,
  permission: Permission,
): Promise<PermissionResult> {

  // ── 1. Bearer token ────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const { bearerAuthGuard } = await import("@/infrastructure/auth/BearerAuthGuard");
    const bearer = await bearerAuthGuard.resolve(authHeader);

    if (!bearer) {
      log.warn("Permission denied: invalid Bearer token", { permission });
      return {
        ok:       false,
        response: problem(401, "Unauthorized", "invalid or expired token", req.url),
      };
    }

    if (!checkPermission(bearer.role, permission)) {
      log.warn("Permission denied via Bearer", {
        sub:        bearer.sub,
        username:   bearer.username,
        role:       bearer.role,
        permission,
      });
      return {
        ok:       false,
        response: problem(403, "Forbidden", `permission '${permission}' required`, req.url),
      };
    }

    return { ok: true, sub: bearer.sub, username: bearer.username, role: bearer.role };
  }

  // ── 2. Session cookie ──────────────────────────────────────────────────────
  const user = await getSessionUserWithOrg();

  if (!user) {
    log.warn("Permission denied: no session", { permission });
    return {
      ok:       false,
      response: problem(401, "Unauthorized", "authentication required", req.url),
    };
  }

  const hasPermission =
    checkPermission(user.role, permission) ||
    (user.extraPermissions ?? []).includes(permission);

  if (!hasPermission) {
    log.warn("Permission denied via session", {
      sub:        user.sub,
      username:   user.username,
      role:       user.role,
      permission,
    });
    return {
      ok:       false,
      response: problem(403, "Forbidden", `permission '${permission}' required`, req.url),
    };
  }

  return { ok: true, sub: user.sub, username: user.username, role: user.role };
}

// ── Helper ────────────────────────────────────────────────────────────────────

function problem(
  status:   number,
  title:    string,
  detail:   string,
  instance: string,
): NextResponse {
  return NextResponse.json(
    { type: "about:blank", title, status, detail, instance },
    { status },
  );
}
