/**
 * GET  /api/users — list all users (admin only)
 * POST /api/users — create a user (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { usersController } from "@/infrastructure/api/controllers/UsersController";
import type { ListUsersQueryDto } from "@/infrastructure/api/dto/UserDto";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden — admin role required" }, { status: 403 });
}

export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    // Distinguish 401 (not logged in) vs 403 (logged in, not admin)
    const { getSessionFromCookies } = await import("@/lib/auth");
    const s = await getSessionFromCookies();
    return s ? forbidden() : unauthorized();
  }

  const sp = request.nextUrl.searchParams;
  const query: ListUsersQueryDto = {
    q:        sp.get("q")        ?? undefined,
    role:     (sp.get("role")    as ListUsersQueryDto["role"])   ?? undefined,
    status:   (sp.get("status")  as ListUsersQueryDto["status"]) ?? undefined,
    page:     sp.get("page")     ? Number(sp.get("page"))     : undefined,
    pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : undefined,
  };

  const result = await usersController.list(query);
  const { httpStatus, ...body } = result;
  return NextResponse.json(body, { status: httpStatus ?? 200 });
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    const { getSessionFromCookies } = await import("@/lib/auth");
    const s = await getSessionFromCookies();
    return s ? forbidden() : unauthorized();
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
