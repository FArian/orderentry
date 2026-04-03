/**
 * GET    /api/users/{id} — get user by ID (admin only)
 * PUT    /api/users/{id} — update user   (admin only)
 * DELETE /api/users/{id} — delete user   (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/auth";
import { usersController } from "@/infrastructure/api/controllers/UsersController";

type Ctx = { params: Promise<{ id: string }> };

function authError(httpStatus: 401 | 403) {
  return NextResponse.json(
    { error: httpStatus === 403 ? "Forbidden — admin role required" : "Unauthorized" },
    { status: httpStatus },
  );
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await checkAdminAccess(req);
  if (!auth.authorized) return authError(auth.httpStatus);

  const { id } = await ctx.params;
  const result = await usersController.getById(id);
  if ("httpStatus" in result) {
    const { httpStatus, ...body } = result;
    return NextResponse.json(body, { status: httpStatus });
  }
  return NextResponse.json(result);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const auth = await checkAdminAccess(req);
  if (!auth.authorized) return authError(auth.httpStatus);

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await usersController.update(id, body as Parameters<typeof usersController.update>[1]);
  if ("httpStatus" in result) {
    const { httpStatus, ...err } = result;
    return NextResponse.json(err, { status: httpStatus });
  }
  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await checkAdminAccess(req);
  if (!auth.authorized) return authError(auth.httpStatus);

  const { id } = await ctx.params;
  const result = await usersController.delete(id);
  const { httpStatus, ...body } = result;
  return NextResponse.json(body, { status: httpStatus ?? 200 });
}
