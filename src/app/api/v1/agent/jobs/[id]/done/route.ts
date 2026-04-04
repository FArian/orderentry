/**
 * POST /api/v1/agent/jobs/[id]/done
 *
 * Agent confirms that a job (print or ORU) has been completed.
 * Sets status → "done" and records doneAt timestamp.
 *
 * Auth: Bearer JWT or PAT
 */

import { NextResponse, type NextRequest } from "next/server";
import { agentJobController } from "@/infrastructure/api/controllers/AgentJobController";
import { bearerAuthGuard } from "@/infrastructure/auth/BearerAuthGuard";
import { getSessionFromCookies } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getSessionFromCookies();
  const bearer  = await bearerAuthGuard.resolve(req.headers.get("authorization"));

  if (!session && !bearer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const result = await agentJobController.markDone(id);
    return NextResponse.json(result);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
