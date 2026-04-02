import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { fhirBase } from "@/config";

/**
 * POST /api/patients/[id]/activate
 *
 * Reactivates an inactive (merged) patient:
 * - Sets active: true
 * - Removes all "replaced-by" links
 */
type Ctx = { params: Promise<{ id: string }> };

export async function POST(
  _req: NextRequest,
  { params }: Ctx
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const srcRes = await fetch(`${fhirBase}/Patient/${id}`, {
      headers: { Accept: "application/fhir+json" },
      cache: "no-store",
    });
    if (!srcRes.ok) {
      return NextResponse.json({ error: `Patient not found: ${id}` }, { status: 404 });
    }
    const patient = await srcRes.json();

    const updated = {
      ...patient,
      active: true,
      // Remove replaced-by links; keep any other link types
      link: (patient.link ?? []).filter(
        (l: { type?: string }) => l.type !== "replaced-by"
      ),
    };
    if (updated.link.length === 0) delete updated.link;

    const putRes = await fetch(`${fhirBase}/Patient/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/fhir+json", Accept: "application/fhir+json" },
      cache: "no-store",
      body: JSON.stringify(updated),
    });

    if (!putRes.ok) {
      const txt = await putRes.text().catch(() => "");
      return NextResponse.json(
        { error: `Failed to reactivate patient: ${putRes.status} ${txt.slice(0, 200)}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ activated: true, id });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Activate failed" },
      { status: 500 }
    );
  }
}
