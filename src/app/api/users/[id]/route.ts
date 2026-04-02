/**
 * GET    /api/users/{id} — get user by ID (admin only)
 * PUT    /api/users/{id} — update user   (admin only)
 * DELETE /api/users/{id} — delete user   (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, getSessionFromCookies } from "@/lib/auth";
import { usersController } from "@/infrastructure/api/controllers/UsersController";

type Ctx = { params: Promise<{ id: string }> };

function unauthorized() { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
function forbidden()     { return NextResponse.json({ error: "Forbidden — admin role required" }, { status: 403 }); }

async function checkAdmin() {
  const session = await getAdminSession();
  if (!session) {
    const s = await getSessionFromCookies();
    return s ? { error: forbidden() } : { error: unauthorized() };
  }
  return { session };
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const check = await checkAdmin();
  if (check.error) return check.error;

  const { id } = await ctx.params;
  const result = await usersController.getById(id);
  if ("httpStatus" in result) {
    const { httpStatus, ...body } = result;
    return NextResponse.json(body, { status: httpStatus });
  }
  return NextResponse.json(result);
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const check = await checkAdmin();
  if (check.error) return check.error;

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
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

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const check = await checkAdmin();
  if (check.error) return check.error;

  const { id } = await ctx.params;
  const result = await usersController.delete(id);
  const { httpStatus, ...body } = result;
  return NextResponse.json(body, { status: httpStatus ?? 200 });
}
