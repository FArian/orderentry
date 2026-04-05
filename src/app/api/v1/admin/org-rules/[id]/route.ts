import { NextRequest, NextResponse } from "next/server";
import { apiGateway }               from "@/infrastructure/api/gateway/ApiGateway";
import { orgRulesController }       from "@/infrastructure/api/controllers/OrgRulesController";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiGateway.handle(
    req,
    { version: "v1", endpoint: "/admin/org-rules/:id", auth: "admin" },
    async () => {
      const { id } = await params;
      const result = await orgRulesController.getById(id);
      const status = (result as { httpStatus?: number }).httpStatus ?? 200;
      const { httpStatus: _, ...data } = result as Record<string, unknown>;
      return NextResponse.json(data, { status });
    },
  );
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiGateway.handle(
    req,
    { version: "v1", endpoint: "/admin/org-rules/:id", auth: "admin" },
    async () => {
      const { id } = await params;
      const body   = await req.json();
      const result = await orgRulesController.update(id, body);
      const status = (result as { httpStatus?: number }).httpStatus ?? 200;
      const { httpStatus: _, ...data } = result as Record<string, unknown>;
      return NextResponse.json(data, { status });
    },
  );
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiGateway.handle(
    req,
    { version: "v1", endpoint: "/admin/org-rules/:id", auth: "admin" },
    async () => {
      const { id } = await params;
      const result = await orgRulesController.delete(id);
      const status = (result as { httpStatus?: number }).httpStatus ?? 200;
      const { httpStatus: _, ...data } = result as Record<string, unknown>;
      return NextResponse.json(data, { status });
    },
  );
}
