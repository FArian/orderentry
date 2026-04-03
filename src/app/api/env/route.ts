/**
 * GET  /api/env  — returns whitelisted environment variables (admin only)
 * POST /api/env  — updates .env.local with the supplied key-value pairs (admin only)
 *
 * Only non-secret variables are exposed. See EnvController for the whitelist.
 */

import { NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/auth";
import { envController } from "@/infrastructure/api/controllers/EnvController";
import type { UpdateEnvRequestDto } from "@/infrastructure/api/dto/EnvDto";

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await checkAdminAccess(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: auth.httpStatus });
  }
  const result = await envController.get();
  return NextResponse.json(result);
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await checkAdminAccess(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: auth.httpStatus });
  }

  let body: UpdateEnvRequestDto;
  try {
    body = (await req.json()) as UpdateEnvRequestDto;
  } catch {
    return NextResponse.json({ ok: false, message: "Ungültiger JSON-Body." }, { status: 400 });
  }

  if (!Array.isArray(body.vars)) {
    return NextResponse.json({ ok: false, message: 'Feld "vars" fehlt oder ist kein Array.' }, { status: 400 });
  }

  const result = await envController.update(body);
  const { httpStatus, ...responseBody } = result;
  return NextResponse.json(responseBody, { status: httpStatus ?? 200 });
}
