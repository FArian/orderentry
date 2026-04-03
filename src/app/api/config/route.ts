/**
 * GET  /api/config  — returns all config entries with source metadata (admin only)
 * POST /api/config  — saves runtime overrides to data/config.json  (admin only)
 */

import { NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/auth";
import { configController } from "@/infrastructure/api/controllers/ConfigController";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await checkAdminAccess(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: auth.httpStatus });
  }
  const result = await configController.get();
  return NextResponse.json(result);
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await checkAdminAccess(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: auth.httpStatus });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("overrides" in body) ||
    typeof (body as Record<string, unknown>).overrides !== "object"
  ) {
    return NextResponse.json(
      { ok: false, message: 'Request body must contain an "overrides" object' },
      { status: 400 },
    );
  }

  const result = await configController.update(
    body as { overrides: Record<string, string | null> },
  );
  const { httpStatus, ...responseBody } = result;
  return NextResponse.json(responseBody, { status: httpStatus ?? 200 });
}
