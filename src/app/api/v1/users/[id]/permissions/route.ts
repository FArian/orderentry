export const dynamic = "force-dynamic";

/**
 * PUT /api/v1/users/{id}/permissions
 * Assign individual extra permissions to a user (admin only).
 * Permissions must be from ASSIGNABLE_PERMISSIONS whitelist.
 */

import { NextRequest, NextResponse } from "next/server";
import { apiGateway } from "@/infrastructure/api/gateway/ApiGateway";
import { usersController } from "@/infrastructure/api/controllers/UsersController";
import type { UpdatePermissionsRequestDto } from "@/infrastructure/api/dto/UserDto";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return apiGateway.handle(
    req,
    { version: "v1", endpoint: `/users/${id}/permissions`, auth: "admin" },
    async () => {
      const body = (await req.json()) as UpdatePermissionsRequestDto;
      const result = await usersController.updatePermissions(id, body);
      const { httpStatus, ...responseBody } = result;
      return NextResponse.json(responseBody, { status: httpStatus ?? 200 });
    },
  );
}
