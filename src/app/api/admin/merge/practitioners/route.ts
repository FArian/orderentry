import { NextResponse } from "next/server";
import { adminMergeController } from "@/infrastructure/api/controllers/AdminMergeController";
import { requireAdmin } from "@/infrastructure/api/controllers/FhirOrganizationsController";
import type { MergePractsRequestDto } from "@/infrastructure/api/controllers/AdminMergeController";

/** POST /api/admin/merge/practitioners — merge two duplicate practitioners by GLN (admin only) */
export async function POST(req: Request) {
  const authErr = await requireAdmin(req);
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.httpStatus });

  let dto: MergePractsRequestDto;
  try {
    dto = (await req.json()) as MergePractsRequestDto;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await adminMergeController.mergePracts(dto);
  const { httpStatus, ...body } = result as typeof result & { httpStatus?: number };
  return NextResponse.json(body, { status: httpStatus ?? 200 });
}
