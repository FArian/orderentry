import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/infrastructure/api/middleware/RequirePermission";
import { PERMISSIONS } from "@/domain/valueObjects/Permission";
import { fhirBase } from "@/config";

/**
 * PATCH /api/patients/[id]/status
 * PATCH /api/v1/patients/[id]/status
 *
 * Activate or deactivate a FHIR Patient.
 * Requires permission: patient:activate
 *
 * Body: { active: boolean }
 */

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const perm = await requirePermission(req, PERMISSIONS.PATIENT_ACTIVATE);
  if (!perm.ok) return perm.response;

  const { id } = await params;

  let active: boolean;
  try {
    const body = (await req.json()) as { active?: unknown };
    if (typeof body.active !== "boolean") {
      return NextResponse.json({ error: "body.active must be a boolean" }, { status: 400 });
    }
    active = body.active;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const getRes = await fetch(`${fhirBase}/Patient/${id}`, {
      headers: { Accept: "application/fhir+json" },
      cache: "no-store",
    });
    if (!getRes.ok) {
      return NextResponse.json({ error: `Patient not found: ${id}` }, { status: 404 });
    }
    const patient = (await getRes.json()) as Record<string, unknown>;

    const updated = { ...patient, active };

    const putRes = await fetch(`${fhirBase}/Patient/${id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/fhir+json", Accept: "application/fhir+json" },
      cache:   "no-store",
      body:    JSON.stringify(updated),
    });

    if (!putRes.ok) {
      const text = await putRes.text().catch(() => "");
      return NextResponse.json(
        { error: `FHIR PUT failed: ${putRes.status} ${text.slice(0, 200)}` },
        { status: 502 },
      );
    }

    return NextResponse.json({ id, active });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Status update failed" },
      { status: 500 },
    );
  }
}
