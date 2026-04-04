/**
 * GET /api/admin/mail/status
 *
 * Returns the current mail configuration status.
 * No credentials or secrets are ever included in the response.
 * Requires admin role.
 *
 * Response 200:
 *   { configured: boolean; provider?: string; authType?: string;
 *     host?: string; port?: number; from?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/auth";
import { mailController } from "@/infrastructure/api/controllers/MailController";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await checkAdminAccess(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: auth.httpStatus },
    );
  }

  return NextResponse.json(mailController.getStatus());
}
