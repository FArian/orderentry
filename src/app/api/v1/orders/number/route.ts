import { NextRequest, NextResponse } from "next/server";
import { apiGateway }               from "@/infrastructure/api/gateway/ApiGateway";
import { numberPoolController }     from "@/infrastructure/api/controllers/NumberPoolController";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return apiGateway.handle(
    req,
    { version: "v1", endpoint: "/orders/number", auth: "public" },
    async () => {
      const body   = await req.json();
      const result = await numberPoolController.generateOrderNumber(body);
      const status = (result as { httpStatus?: number }).httpStatus ?? 200;
      const { httpStatus: _, ...data } = result as Record<string, unknown>;
      return NextResponse.json(data, { status });
    },
  );
}
