import { NextRequest, NextResponse } from "next/server";
import { apiGateway } from "@/infrastructure/api/gateway/ApiGateway";
import { EnvConfig } from "@/infrastructure/config/EnvConfig";

export const dynamic = "force-dynamic";

/** GET /api/v1/admin/debug — returns whether debug mode is enabled (admin only) */
export async function GET(req: NextRequest) {
  return apiGateway.handle(
    req,
    { version: "v1", endpoint: "/admin/debug", auth: "admin" },
    async () => NextResponse.json({ enabled: EnvConfig.debugEnabled }),
  );
}
