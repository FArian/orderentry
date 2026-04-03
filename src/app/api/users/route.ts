/**
 * GET  /api/users — list all users (admin only)
 * POST /api/users — create a user (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/auth";
import { usersController } from "@/infrastructure/api/controllers/UsersController";
import type { ListUsersQueryDto } from "@/infrastructure/api/dto/UserDto";

export async function GET(request: NextRequest) {
  const auth = await checkAdminAccess(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.httpStatus === 403 ? "Forbidden — admin role required" : "Unauthorized" },
      { status: auth.httpStatus },
    );
  }

  const sp = request.nextUrl.searchParams;
  const query: ListUsersQueryDto = {};
  const qVal      = sp.get("q");
  const roleVal   = sp.get("role");
  const statusVal = sp.get("status");
  const pageVal   = sp.get("page");
  const pageSzVal = sp.get("pageSize");
  if (qVal      !== null) query.q        = qVal;
  if (roleVal   !== null) query.role     = roleVal   as NonNullable<ListUsersQueryDto["role"]>;
  if (statusVal !== null) query.status   = statusVal as NonNullable<ListUsersQueryDto["status"]>;
  if (pageVal   !== null) query.page     = Number(pageVal);
  if (pageSzVal !== null) query.pageSize = Number(pageSzVal);

  const result = await usersController.list(query);
  const { httpStatus, ...body } = result;
  return NextResponse.json(body, { status: httpStatus ?? 200 });
}

export async function POST(request: NextRequest) {
  const auth = await checkAdminAccess(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.httpStatus === 403 ? "Forbidden — admin role required" : "Unauthorized" },
      { status: auth.httpStatus },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await usersController.create(body as Parameters<typeof usersController.create>[0]);
  if ("httpStatus" in result) {
    const { httpStatus, ...err } = result;
    return NextResponse.json(err, { status: httpStatus });
  }
  return NextResponse.json(result, { status: 201 });
}
