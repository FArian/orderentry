import { NextResponse }          from "next/server";
import { getSessionUserWithOrg } from "@/lib/auth";
import { ROLE_PERMISSION_MAP }   from "@/domain/policies/RolePermissionMap";

/**
 * GET /api/v1/me/permissions
 *
 * Returns the permission set for the currently authenticated user.
 * The frontend uses this to conditionally show/hide features and actions.
 *
 * Response: { role: string; permissions: string[] }
 * Errors:   401 if no session.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUserWithOrg();
  if (!user) {
    return NextResponse.json(
      { type: "about:blank", title: "Unauthorized", status: 401, detail: "authentication required" },
      { status: 401 },
    );
  }

  const grants = ROLE_PERMISSION_MAP[user.role] ?? new Set();
  const permissions = Array.from(grants).sort();

  return NextResponse.json({ role: user.role, permissions });
}
