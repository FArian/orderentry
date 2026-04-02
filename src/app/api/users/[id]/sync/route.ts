/**
 * POST /api/users/{id}/sync — trigger FHIR synchronisation (admin only)
 *
 * Creates or updates Practitioner / PractitionerRole / Organization
 * in the FHIR server based on the user's profile data.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, getSessionFromCookies } from "@/lib/auth";
import { usersController } from "@/infrastructure/api/controllers/UsersController";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const session = await getAdminSession();
  if (!session) {
    const s = await getSessionFromCookies();
    return s
      ? NextResponse.json({ error: "Forbidden — admin role required" }, { status: 403 })
      : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const result = await usersController.syncToFhir(id);
  const { httpStatus, ...body } = result;
  return NextResponse.json(body, { status: httpStatus ?? 200 });
}
