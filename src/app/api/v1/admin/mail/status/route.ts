/**
 * GET /api/v1/admin/mail/status
 *
 * Versioned gateway-wrapped endpoint. Returns current mail provider
 * configuration — no credentials or secrets are ever included.
 *
 * Auth:     admin role required (enforced by ApiGateway)
 * Gateway:  request ID · structured logging · error normalisation
 *
 * Response 200:
 *   { configured: boolean; provider?: string; authType?: string;
 *     host?: string; port?: number; from?: string }
 *
 * Canonical unversioned path: GET /api/admin/mail/status
 */

import { NextRequest, NextResponse } from "next/server";
import { apiGateway } from "@/infrastructure/api/gateway/ApiGateway";
import { mailController } from "@/infrastructure/api/controllers/MailController";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  return apiGateway.handle(
    req,
    { version: "v1", endpoint: "/admin/mail/status", auth: "admin" },
    async () => NextResponse.json(mailController.getStatus()),
  );
}
