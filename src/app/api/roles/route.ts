/**
 * GET  /api/roles — list all catalog roles (public — needed by user-form dropdown)
 * POST /api/roles — create a role (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, getSessionFromCookies } from "@/lib/auth";
import { rolesController } from "@/infrastructure/api/controllers/RolesController";
import type { CreateRoleRequestDto } from "@/infrastructure/api/dto/RoleDto";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ error: "Forbidden — admin role required" }, { status: 403 });
}

// Public — the role catalog is non-sensitive metadata needed by the user form.
export async function GET() {
  const result = await rolesController.list();
  const { httpStatus, ...body } = result;
  return NextResponse.json(body, { status: httpStatus ?? 200 });
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    const s = await getSessionFromCookies();
    return s ? forbidden() : unauthorized();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await rolesController.create(body as CreateRoleRequestDto);
  if ("httpStatus" in result) {
    const { httpStatus, ...err } = result;
    return NextResponse.json(err, { status: httpStatus });
  }
  return NextResponse.json(result, { status: 201 });
}
