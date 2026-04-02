/**
 * GET  /api/config  — returns all config entries with source metadata
 * POST /api/config  — saves runtime overrides to data/config.json
 */

import { NextResponse } from "next/server";
import { configController } from "@/infrastructure/api/controllers/ConfigController";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const result = await configController.get();
  return NextResponse.json(result);
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON body" },
      { status: 400 },
    );
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
