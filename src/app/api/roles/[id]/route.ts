/**
 * GET    /api/roles/[id] — get single role (public)
 * PUT    /api/roles/[id] — update role (admin only)
 * DELETE /api/roles/[id] — delete role (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, getSessionFromCookies } from "@/lib/auth";
import { rolesController } from "@/infrastructure/api/controllers/RolesController";
import type { UpdateRoleRequestDto } from "@/infrastructure/api/dto/RoleDto";

type Ctx = { params: Promise<{ id: string }> };

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ error: "Forbidden — admin role required" }, { status: 403 });
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const result = await rolesController.getById(id);
  if ("httpStatus" in result) {
    const { httpStatus, ...err } = result;
    return NextResponse.json(err, { status: httpStatus });
  }
  return NextResponse.json(result);
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) {
    const s = await getSessionFromCookies();
    return s ? forbidden() : unauthorized();
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await rolesController.update(id, body as UpdateRoleRequestDto);
  if ("httpStatus" in result) {
    const { httpStatus, ...err } = result;
    return NextResponse.json(err, { status: httpStatus });
  }
  return NextResponse.json(result);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) {
    const s = await getSessionFromCookies();
    return s ? forbidden() : unauthorized();
  }

  const { id } = await params;
  const result = await rolesController.delete(id);
  const { httpStatus, ...body } = result;
  return NextResponse.json(body, { status: httpStatus ?? 200 });
}
