import { NextRequest, NextResponse } from "next/server";
import { apiGateway }               from "@/infrastructure/api/gateway/ApiGateway";
import { numberPoolController }     from "@/infrastructure/api/controllers/NumberPoolController";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiGateway.handle(
    req,
    { version: "v1", endpoint: "/admin/number-pool/:id", auth: "admin" },
    async () => {
      const { id } = await params;
      const result = await numberPoolController.deleteNumber(id);
      const status = (result as { httpStatus?: number }).httpStatus ?? 200;
      const { httpStatus: _, ...data } = result as Record<string, unknown>;
      return NextResponse.json(data, { status });
    },
  );
}
