/**
 * POST /api/v1/admin/mail/test
 *
 * Versioned gateway-wrapped endpoint. Verifies the configured SMTP connection
 * and optionally sends a test email to the given address.
 *
 * Auth:     admin role required (enforced by ApiGateway)
 * Gateway:  request ID · structured logging · error normalisation
 *
 * Request body (optional JSON):
 *   { "to": "recipient@example.com" }
 *
 * Responses:
 *   200  { ok: true,  message, provider, from, durationMs }
 *   502  { ok: false, message, provider, durationMs }  — SMTP unreachable
 *   503  { ok: false, message }                        — not configured
 *   401 / 403                                          — auth required
 *
 * Canonical unversioned path: POST /api/admin/mail/test
 */

import { NextRequest, NextResponse } from "next/server";
import { apiGateway } from "@/infrastructure/api/gateway/ApiGateway";
import { mailController } from "@/infrastructure/api/controllers/MailController";
import type { MailTestRequestDto } from "@/infrastructure/api/dto/MailDto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  return apiGateway.handle(
    req,
    { version: "v1", endpoint: "/admin/mail/test", auth: "admin" },
    async () => {
      let body: MailTestRequestDto = {};
      try {
        body = (await req.json()) as MailTestRequestDto;
      } catch {
        // empty or non-JSON body — treat as verify-only
      }
      const result = await mailController.test(body);
      const { httpStatus = 200, ...responseBody } = result;
      return NextResponse.json(responseBody, { status: httpStatus });
    },
  );
}
