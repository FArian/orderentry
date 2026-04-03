/**
 * GET /api/env/schema — complete catalog of all ENV vars the app supports.
 *
 * Returns every environment variable the application understands, including:
 *   - Description and purpose
 *   - Default value
 *   - Current value (secrets masked as "••••••••")
 *   - Whether it is writable via POST /api/env
 *   - Whether a restart is required after changing it
 *   - Logical group (FHIR, Authentication, Logging, Observability, …)
 *
 * Admin only (session cookie or Bearer JWT/PAT).
 */

import { NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/auth";
import { envController } from "@/infrastructure/api/controllers/EnvController";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await checkAdminAccess(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: auth.httpStatus });
  }

  return NextResponse.json(envController.getSchema());
}
