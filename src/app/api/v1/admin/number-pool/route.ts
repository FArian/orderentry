import { NextRequest, NextResponse } from "next/server";
import { apiGateway }               from "@/infrastructure/api/gateway/ApiGateway";
import { numberPoolController }     from "@/infrastructure/api/controllers/NumberPoolController";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return apiGateway.handle(
    req,
    { version: "v1", endpoint: "/admin/number-pool", auth: "admin" },
    async () => {
      const result = await numberPoolController.listPool();
      return NextResponse.json(result);
    },
  );
}

export async function POST(req: NextRequest) {
  return apiGateway.handle(
    req,
    { version: "v1", endpoint: "/admin/number-pool", auth: "admin" },
    async () => {
      const body   = await req.json();
      const result = await numberPoolController.addNumbers(body);
      const status = (result as { httpStatus?: number }).httpStatus ?? 201;
      const { httpStatus: _, ...data } = result as Record<string, unknown>;
      return NextResponse.json(data, { status });
    },
  );
}
