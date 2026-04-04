/**
 * POST /api/admin/mail/test
 *
 * Verifies the configured SMTP connection and optionally sends a test email.
 * Requires admin role. Delegates all logic to MailController.
 *
 * Request body (optional JSON):
 *   { "to": "recipient@example.com" }
 *
 * Responses:
 *   200 { ok: true,  message, provider, from, durationMs }
 *   502 { ok: false, message, provider, durationMs }        — SMTP unreachable / auth failed
 *   503 { ok: false, message }                              — MAIL_PROVIDER not configured
 *   401 / 403                                               — auth required
 */

import { NextRequest, NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/auth";
import { mailController } from "@/infrastructure/api/controllers/MailController";
import type { MailTestRequestDto } from "@/infrastructure/api/dto/MailDto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await checkAdminAccess(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: auth.httpStatus },
    );
  }

  let body: MailTestRequestDto = {};
  try {
    body = (await req.json()) as MailTestRequestDto;
  } catch {
    // empty or non-JSON body — treat as verify-only request
  }

  const result = await mailController.test(body);
  const { httpStatus = 200, ...responseBody } = result;
  return NextResponse.json(responseBody, { status: httpStatus });
}
