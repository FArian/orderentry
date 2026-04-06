import { NextRequest, NextResponse } from "next/server";
import { apiGateway }               from "@/infrastructure/api/gateway/ApiGateway";
import { poolAlertTaskController }  from "@/infrastructure/api/controllers/PoolAlertTaskController";

export const dynamic = "force-dynamic";

/** POST /api/v1/admin/pool-tasks/:id/resolve — resolve a pool alert task (admin only) */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return apiGateway.handle(
    req,
    { version: "v1", endpoint: `/admin/pool-tasks/${id}/resolve`, auth: "admin" },
    async () => {
      const result = await poolAlertTaskController.resolve(id);
      const { httpStatus, ...body } = result as typeof result & { httpStatus?: number };
      return NextResponse.json(body, { status: httpStatus ?? 200 });
    },
  );
}
