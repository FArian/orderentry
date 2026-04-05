/**
 * POST /api/v1/agent/register
 *
 * Registers a new Local Agent for a clinic/practice.
 * Returns the plaintext API key — shown ONCE, never stored.
 * Auth: admin session required.
 */

import { NextResponse, type NextRequest } from "next/server";
import { apiGateway } from "@/infrastructure/api/gateway/ApiGateway";
import { agentRegistrationController } from "@/infrastructure/api/controllers/AgentRegistrationController";
import type { RegisterAgentRequestDto } from "@/infrastructure/api/dto/AgentRegistrationDto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  return apiGateway.handle(
    req,
    { version: "v1", endpoint: "/agent/register", auth: "admin" },
    async () => {
      const body = await req.json() as RegisterAgentRequestDto;
      const result = await agentRegistrationController.register(body);
      return NextResponse.json(result, { status: 201 });
    },
  );
}
