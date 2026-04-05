/**
 * GET /api/v1/admin/agents — List all registered agents
 * Auth: admin session required.
 */

import { NextResponse, type NextRequest } from "next/server";
import { apiGateway } from "@/infrastructure/api/gateway/ApiGateway";
import { agentRegistrationController } from "@/infrastructure/api/controllers/AgentRegistrationController";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  return apiGateway.handle(
    req,
    { version: "v1", endpoint: "/admin/agents", auth: "admin" },
    async () => {
      const result = await agentRegistrationController.list();
      return NextResponse.json(result);
    },
  );
}
