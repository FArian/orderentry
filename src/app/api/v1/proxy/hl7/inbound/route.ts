/**
 * POST /api/v1/proxy/hl7/inbound
 *
 * Receives a raw HL7v2 message from the Edge agent and forwards it to Orchestra.
 * Orchestra converts HL7 → FHIR and stores the result in HAPI FHIR.
 *
 * OrderEntry does NOT parse or interpret the HL7 content — pure proxy.
 *
 * Auth:         Bearer JWT or PAT (POST /api/v1/auth/token), or session cookie
 * Content-Type: text/plain | application/hl7-v2 | application/octet-stream
 * Body:         Raw HL7v2 message (MSH segment first)
 *
 * Response 202: { accepted: true, messageId?, detail? }
 * Response 503: Orchestra not configured (ORCHESTRA_HL7_BASE not set)
 * Response 502: Orchestra unreachable
 */

import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { bearerAuthGuard } from "@/infrastructure/auth/BearerAuthGuard";
import { hl7ProxyController } from "@/infrastructure/api/controllers/Hl7ProxyController";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  const session = await getSessionFromCookies();
  const bearer  = await bearerAuthGuard.resolve(req.headers.get("authorization"));

  if (!session && !bearer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "text/plain; charset=utf-8";
  const body        = await req.text();

  if (!body.trim()) {
    return NextResponse.json({ error: "Empty HL7 body" }, { status: 400 });
  }

  const result = await hl7ProxyController.inbound(body, contentType);
  const { httpStatus, ...payload } = result;
  return NextResponse.json(payload, { status: httpStatus });
}
