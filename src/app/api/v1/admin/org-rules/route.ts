import { NextRequest, NextResponse } from "next/server";
import { apiGateway }               from "@/infrastructure/api/gateway/ApiGateway";
import { orgRulesController }       from "@/infrastructure/api/controllers/OrgRulesController";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return apiGateway.handle(
    req,
    { version: "v1", endpoint: "/admin/org-rules", auth: "admin" },
    async () => {
      const result = await orgRulesController.list();
      return NextResponse.json(result);
    },
  );
}

export async function POST(req: NextRequest) {
  return apiGateway.handle(
    req,
    { version: "v1", endpoint: "/admin/org-rules", auth: "admin" },
    async () => {
      const body   = await req.json();
      const result = await orgRulesController.create(body);
      const status = (result as { httpStatus?: number }).httpStatus ?? 201;
      const { httpStatus: _, ...data } = result as Record<string, unknown>;
      return NextResponse.json(data, { status });
    },
  );
}
