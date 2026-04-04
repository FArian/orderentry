/**
 * GET /api/v1/proxy/hl7/outbound
 *
 * Retrieves outbound HL7 messages (e.g. ORU results) from Orchestra.
 * The Edge agent polls this endpoint and writes results to the local filesystem.
 *
 * Orchestra converts FHIR DiagnosticReport → HL7 ORU before responding.
 * OrderEntry does NOT parse or interpret the HL7 content — pure proxy.
 *
 * Auth:   Bearer JWT or PAT, or session cookie
 *
 * Query params:
 *   since  — ISO 8601 timestamp for incremental polling (e.g. 2026-04-01T00:00:00Z)
 *   format — HL7 message type filter: ORU | ADT | ORM (default: all)
 *   limit  — max messages per response (default: 100)
 *
 * Response 200: { messages: Hl7Message[], total: number }
 * Response 503: Orchestra not configured
 * Response 502: Orchestra unreachable
 */

import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { bearerAuthGuard } from "@/infrastructure/auth/BearerAuthGuard";
import { hl7ProxyController } from "@/infrastructure/api/controllers/Hl7ProxyController";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const session = await getSessionFromCookies();
  const bearer  = await bearerAuthGuard.resolve(req.headers.get("authorization"));

  if (!session && !bearer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  const params: { since?: string; format?: string; limit?: string } = {};
  const since  = searchParams.get("since");
  const format = searchParams.get("format");
  const limit  = searchParams.get("limit");
  if (since)  params.since  = since;
  if (format) params.format = format;
  if (limit)  params.limit  = limit;

  const result = await hl7ProxyController.outbound(params);

  const { httpStatus, ...payload } = result;
  return NextResponse.json(payload, { status: httpStatus });
}
