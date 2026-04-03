/**
 * POST /api/auth/token — exchange admin credentials for a JWT access token.
 *
 * Body:    { username, password, expiresIn?: "1h"|"24h"|"7d"|"30d"|"90d" }
 * Returns: { accessToken, tokenType: "Bearer", expiresIn }
 *
 * Only admin users may obtain JWT tokens via this endpoint.
 */

import { NextResponse } from "next/server";
import { authTokenController } from "@/infrastructure/api/controllers/AuthTokenController";
import type { ExchangeCredentialsDto } from "@/infrastructure/api/controllers/AuthTokenController";

export async function POST(req: Request) {
  let body: ExchangeCredentialsDto;
  try {
    body = (await req.json()) as ExchangeCredentialsDto;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await authTokenController.exchange(body);
  if ("httpStatus" in result) {
    const { httpStatus, ...err } = result;
    return NextResponse.json(err, { status: httpStatus });
  }
  return NextResponse.json(result);
}
