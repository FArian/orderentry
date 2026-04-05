import { NextRequest, NextResponse } from "next/server";
import { apiGateway }               from "@/infrastructure/api/gateway/ApiGateway";
import { numberPoolController }     from "@/infrastructure/api/controllers/NumberPoolController";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return apiGateway.handle(
    req,
    { version: "v1", endpoint: "/admin/number-pool/thresholds", auth: "admin" },
    async () => {
      const result = await numberPoolController.getThresholds();
      return NextResponse.json(result);
    },
  );
}

export async function PUT(req: NextRequest) {
  return apiGateway.handle(
    req,
    { version: "v1", endpoint: "/admin/number-pool/thresholds", auth: "admin" },
    async () => {
      const body   = await req.json();
      const result = await numberPoolController.updateThresholds(body);
      const status = (result as { httpStatus?: number }).httpStatus ?? 200;
      const { httpStatus: _, ...data } = result as Record<string, unknown>;
      return NextResponse.json(data, { status });
    },
  );
}
