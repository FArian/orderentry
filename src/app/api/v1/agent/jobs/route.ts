/**
 * GET  /api/v1/agent/jobs       — Agent polls for pending print/ORU jobs
 * POST /api/v1/agent/jobs/print — Create a print job after order submission
 *
 * Auth: Bearer JWT or PAT (same as /agent/status)
 *
 * GET query params:
 *   orgId      (required) — FHIR Organization ID
 *   locationId (optional) — FHIR Location ID for targeted routing
 */

import { NextResponse, type NextRequest } from "next/server";
import { agentJobController } from "@/infrastructure/api/controllers/AgentJobController";
import { bearerAuthGuard } from "@/infrastructure/auth/BearerAuthGuard";
import { getSessionFromCookies } from "@/lib/auth";
import type { CreatePrintJobRequestDto } from "@/infrastructure/api/dto/AgentJobDto";

export const dynamic = "force-dynamic";

async function resolveAuth(req: NextRequest): Promise<boolean> {
  const session = await getSessionFromCookies();
  if (session) return true;
  const bearer = await bearerAuthGuard.resolve(req.headers.get("authorization"));
  return bearer !== null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!await resolveAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const orgId      = searchParams.get("orgId")      ?? "";
  const locationId = searchParams.get("locationId") ?? undefined;

  try {
    const result = await agentJobController.listJobs(orgId, locationId);
    return NextResponse.json(result);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!await resolveAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json() as CreatePrintJobRequestDto;
    const result = await agentJobController.createPrintJob(body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
