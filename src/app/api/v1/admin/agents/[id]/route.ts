/**
 * DELETE /api/v1/admin/agents/[id] — Remove agent registration
 * PATCH  /api/v1/admin/agents/[id] — Revoke agent (status → revoked)
 * Auth: admin session required.
 */

import { NextResponse, type NextRequest } from "next/server";
import { apiGateway } from "@/infrastructure/api/gateway/ApiGateway";
import { agentRegistrationController } from "@/infrastructure/api/controllers/AgentRegistrationController";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return apiGateway.handle(
    req,
    { version: "v1", endpoint: "/admin/agents/[id]", auth: "admin" },
    async () => {
      const { id } = await params;
      const result = await agentRegistrationController.revoke(id);
      return NextResponse.json(result);
    },
  );
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return apiGateway.handle(
    req,
    { version: "v1", endpoint: "/admin/agents/[id]", auth: "admin" },
    async () => {
      const { id } = await params;
      const result = await agentRegistrationController.remove(id);
      return NextResponse.json(result);
    },
  );
}
