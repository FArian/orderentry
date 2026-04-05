import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { fhirBase } from "@/config";
import { createLogger } from "@/infrastructure/logging/Logger";

const log = createLogger("patient-merge");

/**
 * POST /api/patients/[id]/merge
 * Body: { sourceId: string }
 *
 * Merges sourceId into targetId (id from URL) using FHIR $merge operation.
 * Falls back to Patient.link if $merge is not supported.
 *
 * After merge:
 * - target patient survives (id from URL param)
 * - source patient is linked as "replaced-by" → target
 */
type Ctx = { params: Promise<{ id: string }> };

export async function POST(
  req: NextRequest,
  { params }: Ctx
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: targetId } = await params;
  let sourceId: string;
  try {
    const body = await req.json();
    sourceId = body.sourceId;
    if (!sourceId) throw new Error("missing sourceId");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Strategy 1: try FHIR $merge operation (HAPI FHIR supports this)
  try {
    const mergeRes = await fetch(`${fhirBase}/Patient/$merge`, {
      method: "POST",
      headers: { "Content-Type": "application/fhir+json", Accept: "application/fhir+json" },
      cache: "no-store",
      body: JSON.stringify({
        resourceType: "Parameters",
        parameter: [
          { name: "source-patient", valueReference: { reference: `Patient/${sourceId}` } },
          { name: "target-patient", valueReference: { reference: `Patient/${targetId}` } },
          { name: "result-patient", valueReference: { reference: `Patient/${targetId}` } },
        ],
      }),
    });

    if (mergeRes.ok) {
      return NextResponse.json({ merged: true, targetId, sourceId, method: "fhir-merge" });
    }
    // Any non-2xx → fall through to Patient.link fallback
  } catch (err: unknown) {
    // network error on $merge — try Patient.link fallback
    log.debug("FHIR $merge failed, falling back to Patient.link", { sourceId, targetId, message: err instanceof Error ? err.message : String(err) });
  }

  // Strategy 2: Mark source patient as inactive and add Patient.link replaced-by → target
  try {
    // Fetch current source patient
    const srcRes = await fetch(`${fhirBase}/Patient/${sourceId}`, {
      headers: { Accept: "application/fhir+json" },
      cache: "no-store",
    });
    if (!srcRes.ok) {
      return NextResponse.json({ error: `Source patient not found: ${sourceId}` }, { status: 404 });
    }
    const src = await srcRes.json();

    const updated = {
      ...src,
      active: false,
      link: [
        ...(src.link ?? []),
        {
          other: { reference: `Patient/${targetId}` },
          type: "replaced-by",
        },
      ],
    };

    const putRes = await fetch(`${fhirBase}/Patient/${sourceId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/fhir+json", Accept: "application/fhir+json" },
      cache: "no-store",
      body: JSON.stringify(updated),
    });

    if (!putRes.ok) {
      const txt = await putRes.text().catch(() => "");
      return NextResponse.json({ error: `Failed to update source patient: ${putRes.status} ${txt.slice(0, 200)}` }, { status: 502 });
    }

    return NextResponse.json({ merged: true, targetId, sourceId, method: "patient-link" });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Merge failed" },
      { status: 500 }
    );
  }
}
