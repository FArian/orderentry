import { NextResponse } from "next/server";
import { adminMergeController } from "@/infrastructure/api/controllers/AdminMergeController";
import { requireAdmin } from "@/infrastructure/api/controllers/FhirOrganizationsController";
import type { MergeOrgsRequestDto } from "@/infrastructure/api/controllers/AdminMergeController";

/** POST /api/admin/merge/organizations — merge two duplicate orgs by GLN (admin only) */
export async function POST(req: Request) {
  const authErr = await requireAdmin(req);
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.httpStatus });

  let dto: MergeOrgsRequestDto;
  try {
    dto = (await req.json()) as MergeOrgsRequestDto;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await adminMergeController.mergeOrgs(dto);
  const { httpStatus, ...body } = result as typeof result & { httpStatus?: number };
  return NextResponse.json(body, { status: httpStatus ?? 200 });
}
