import { NextResponse } from "next/server";
import { adminMergeController } from "@/infrastructure/api/controllers/AdminMergeController";
import { requireAdmin } from "@/infrastructure/api/controllers/FhirOrganizationsController";

/** GET /api/admin/merge — list duplicate GLN groups (admin only) */
export async function GET(req: Request) {
  const authErr = await requireAdmin(req);
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.httpStatus });

  const result = await adminMergeController.status();
  const { httpStatus, ...body } = result as typeof result & { httpStatus?: number };
  return NextResponse.json(body, { status: httpStatus ?? 200 });
}
