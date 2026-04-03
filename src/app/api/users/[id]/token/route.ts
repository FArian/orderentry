/**
 * POST   /api/users/{id}/token — generate a Personal Access Token (admin only)
 * DELETE /api/users/{id}/token — revoke the Personal Access Token (admin only)
 *
 * The plaintext PAT is returned ONCE on POST and cannot be retrieved again.
 * Store it securely immediately.
 */

import { NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/auth";
import { usersController } from "@/infrastructure/api/controllers/UsersController";

type Ctx = { params: Promise<{ id: string }> };

function authError(httpStatus: 401 | 403) {
  return NextResponse.json(
    { error: httpStatus === 403 ? "Forbidden — admin role required" : "Unauthorized" },
    { status: httpStatus },
  );
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = await checkAdminAccess(req);
  if (!auth.authorized) return authError(auth.httpStatus);

  const { id } = await ctx.params;
  const result = await usersController.generateToken(id);
  if ("httpStatus" in result) {
    const { httpStatus, ...err } = result;
    return NextResponse.json(err, { status: httpStatus });
  }
  return NextResponse.json(result, { status: 201 });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await checkAdminAccess(req);
  if (!auth.authorized) return authError(auth.httpStatus);

  const { id } = await ctx.params;
  const result = await usersController.revokeToken(id);
  if ("httpStatus" in result) {
    const { httpStatus, ...err } = result;
    return NextResponse.json(err, { status: httpStatus });
  }
  return NextResponse.json(result);
}
