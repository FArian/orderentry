/**
 * GET  /api/env  — returns whitelisted environment variables from .env.local
 * POST /api/env  — updates .env.local with the supplied key-value pairs
 *
 * Only non-secret variables are exposed. See EnvController for the whitelist.
 */

import { NextResponse } from "next/server";
import { envController } from "@/infrastructure/api/controllers/EnvController";
import type { UpdateEnvRequestDto } from "@/infrastructure/api/dto/EnvDto";

export async function GET(): Promise<NextResponse> {
  const result = await envController.get();
  return NextResponse.json(result);
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: UpdateEnvRequestDto;
  try {
    body = (await request.json()) as UpdateEnvRequestDto;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Ungültiger JSON-Body." },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.vars)) {
    return NextResponse.json(
      { ok: false, message: 'Feld "vars" fehlt oder ist kein Array.' },
      { status: 400 },
    );
  }

  const result = await envController.update(body);
  const { httpStatus, ...responseBody } = result;
  return NextResponse.json(responseBody, { status: httpStatus ?? 200 });
}
