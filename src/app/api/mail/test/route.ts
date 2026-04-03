/**
 * POST /api/mail/test
 *
 * Tests the configured mail server connection and optionally sends a test email.
 * Uses whatever provider + auth is currently configured via MAIL_* ENV vars.
 *
 * Request body (optional):
 *   { sendEmail?: boolean; to?: string }
 *
 * Response (always HTTP 200 — check `ok` for success):
 *   { ok: boolean; message: string; provider?: string; from?: string }
 *
 * Admin role required.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/auth";
import { mailService } from "@/infrastructure/mail/MailServiceFactory";
import { EnvConfig } from "@/infrastructure/config/EnvConfig";

export const dynamic = "force-dynamic";

interface TestMailRequestBody {
  sendEmail?: boolean;
  to?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await checkAdminAccess(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: auth.httpStatus },
    );
  }

  if (!mailService.isConfigured()) {
    return NextResponse.json({
      ok: false,
      message: "Mail server not configured — set MAIL_PROVIDER in environment variables",
    });
  }

  // Verify SMTP connection
  const verifyResult = await mailService.verify();
  if (!verifyResult.ok) {
    return NextResponse.json({
      ok: false,
      message: verifyResult.message,
      provider: EnvConfig.mailProvider,
    });
  }

  // Optionally send a test email
  let body: TestMailRequestBody = {};
  try {
    body = (await req.json()) as TestMailRequestBody;
  } catch {
    // empty body is fine
  }

  if (body.sendEmail && body.to) {
    try {
      await mailService.send({
        to: body.to,
        subject: "z2Lab OrderEntry — Test-E-Mail",
        text: "Diese E-Mail wurde vom z2Lab OrderEntry Mail-System gesendet.\n\n" +
              `Provider: ${EnvConfig.mailProvider}\n` +
              `Auth: ${EnvConfig.mailAuthType}\n`,
        html: "<p>Diese E-Mail wurde vom <strong>z2Lab OrderEntry</strong> Mail-System gesendet.</p>" +
              `<p><strong>Provider:</strong> ${EnvConfig.mailProvider}<br>` +
              `<strong>Auth:</strong> ${EnvConfig.mailAuthType}</p>`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Send failed";
      return NextResponse.json({ ok: false, message, provider: EnvConfig.mailProvider });
    }
  }

  return NextResponse.json({
    ok: true,
    message: body.sendEmail
      ? `Connection verified and test email sent to ${body.to}`
      : "Mail server reachable and authentication successful",
    provider: EnvConfig.mailProvider,
    from: EnvConfig.mailFrom || EnvConfig.mailUser,
  });
}
