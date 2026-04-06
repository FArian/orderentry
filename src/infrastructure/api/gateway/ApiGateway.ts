/**
 * ApiGateway — centralized handler wrapper for versioned API routes.
 *
 * Provides cross-cutting concerns for every route that opts in:
 *   1. Request ID generation  (x-request-id header on every response)
 *   2. Structured access log  (version, method, path, status, ms)
 *   3. Admin/user auth check  (delegates to checkAdminAccess / session guard)
 *   4. Error normalisation    (uncaught throws → RFC 7807 Problem Details)
 *
 * Usage in a route handler:
 *
 *   export async function POST(req: NextRequest) {
 *     return apiGateway.handle(
 *       req,
 *       { version: "v1", endpoint: "/admin/mail/test", auth: "admin" },
 *       async () => {
 *         const result = await mailController.test(await req.json());
 *         const { httpStatus = 200, ...body } = result;
 *         return NextResponse.json(body, { status: httpStatus });
 *       },
 *     );
 *   }
 *
 * Design constraints:
 *   - Server-only module (imports Logger + checkAdminAccess — never bundle to client)
 *   - No static Node.js built-in imports at top level (safe: no fs/path here)
 *   - `crypto.randomUUID()` is available globally in Node 19+ and Next.js 15
 */

import { NextRequest, NextResponse } from "next/server";
import { createLogger }          from "@/infrastructure/logging/Logger";
import { requirePermission }     from "@/infrastructure/api/middleware/RequirePermission";
import { PERMISSIONS }           from "@/domain/valueObjects/Permission";

const log = createLogger("ApiGateway");

// ── Types ─────────────────────────────────────────────────────────────────────

/** API version — extend the union when v2 launches. */
export type ApiVersion = "v1";

/** Who may call this endpoint. */
export type GatewayAuth = "admin" | "public";

export interface GatewayConfig {
  /** API version for logging and error `instance` paths. */
  readonly version:  ApiVersion;
  /** Endpoint path without the version prefix, e.g. "/admin/mail/test". */
  readonly endpoint: string;
  /** Auth requirement — "admin" calls checkAdminAccess; "public" skips auth. */
  readonly auth:     GatewayAuth;
}

/** A route handler that the gateway wraps. */
type GatewayHandler = (req: NextRequest) => Promise<NextResponse>;

// ── Gateway ───────────────────────────────────────────────────────────────────

class ApiGateway {
  /**
   * Wraps a route handler with request ID, logging, auth, and error handling.
   * Always returns a NextResponse — never throws.
   */
  async handle(
    req:    NextRequest,
    config: GatewayConfig,
    fn:     GatewayHandler,
  ): Promise<NextResponse> {
    const requestId  = crypto.randomUUID();
    const start      = Date.now();
    const { version, endpoint, auth } = config;
    const fullPath   = `/api/${version}${endpoint}`;

    log.info(`→ ${req.method} ${fullPath}`, { requestId });

    // ── Auth ────────────────────────────────────────────────────────────────
    if (auth === "admin") {
      const perm = await requirePermission(req, PERMISSIONS.ADMIN_ACCESS);
      if (!perm.ok) {
        const status = perm.response.status as 401 | 403;
        const title  = status === 403 ? "Forbidden" : "Unauthorized";
        log.warn(`✗ ${req.method} ${fullPath} ${status}`, { requestId });
        return buildProblemResponse(title, status, `permission '${PERMISSIONS.ADMIN_ACCESS}' required`, fullPath, requestId);
      }
    }

    // ── Handler ─────────────────────────────────────────────────────────────
    try {
      const response = await fn(req);
      const ms       = Date.now() - start;
      log.info(`✓ ${req.method} ${fullPath} ${response.status} (${ms}ms)`, { requestId });
      return addRequestId(response, requestId);
    } catch (err: unknown) {
      const ms      = Date.now() - start;
      const message = err instanceof Error ? err.message : "Internal server error";
      log.error(`✗ ${req.method} ${fullPath} 500 (${ms}ms)`, { requestId, error: message });
      return buildProblemResponse("Internal Server Error", 500, message, fullPath, requestId);
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildProblemResponse(
  title:     string,
  status:    number,
  detail:    string,
  instance:  string,
  requestId: string,
): NextResponse {
  return NextResponse.json(
    { type: "about:blank", title, status, detail, instance },
    {
      status,
      headers: { "x-request-id": requestId },
    },
  );
}

function addRequestId(response: NextResponse, requestId: string): NextResponse {
  const headers = new Headers(response.headers);
  headers.set("x-request-id", requestId);
  return new NextResponse(response.body, {
    status:  response.status,
    headers,
  });
}

// ── Module-level singleton ────────────────────────────────────────────────────

export const apiGateway = new ApiGateway();
