import { NextResponse } from "next/server";
import { adminTasksController } from "@/infrastructure/api/controllers/AdminTasksController";
import { requireAdmin } from "@/infrastructure/api/controllers/FhirOrganizationsController";

/** GET /api/admin/tasks — list records with missing GLN (admin only) */
export async function GET(req: Request) {
  const authErr = await requireAdmin(req);
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.httpStatus });

  const result = await adminTasksController.list();
  const { httpStatus, ...body } = result as typeof result & { httpStatus?: number };
  return NextResponse.json(body, { status: httpStatus ?? 200 });
}
