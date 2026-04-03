/**
 * POST /api/users/{id}/sync — trigger FHIR synchronisation (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/auth";
import { usersController } from "@/infrastructure/api/controllers/UsersController";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await checkAdminAccess(req);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.httpStatus === 403 ? "Forbidden — admin role required" : "Unauthorized" },
      { status: auth.httpStatus },
    );
  }

  const { id } = await ctx.params;
  const result = await usersController.syncToFhir(id);
  const { httpStatus, ...body } = result;
  return NextResponse.json(body, { status: httpStatus ?? 200 });
}
