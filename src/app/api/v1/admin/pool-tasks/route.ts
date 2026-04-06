import { NextRequest, NextResponse } from "next/server";
import { apiGateway }               from "@/infrastructure/api/gateway/ApiGateway";
import { poolAlertTaskController }  from "@/infrastructure/api/controllers/PoolAlertTaskController";

export const dynamic = "force-dynamic";

/** GET /api/v1/admin/pool-tasks — list open pool alert tasks (admin only) */
export async function GET(req: NextRequest) {
  return apiGateway.handle(
    req,
    { version: "v1", endpoint: "/admin/pool-tasks", auth: "admin" },
    async () => {
      const result = await poolAlertTaskController.list();
      return NextResponse.json(result);
    },
  );
}
