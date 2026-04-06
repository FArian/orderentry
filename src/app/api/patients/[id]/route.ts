import { NextResponse } from "next/server";
import { FHIR_BASE, FHIR_SYSTEMS } from "@/lib/fhir";
import { EnvConfig } from "@/infrastructure/config/EnvConfig";
import { getSessionFromCookies } from "@/lib/auth";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const url = new URL(`${FHIR_BASE}/Patient/${encodeURIComponent(id)}`);
    const res = await fetch(url.toString(), {
      headers: { accept: "application/fhir+json" },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `FHIR error: ${res.status}` },
        { status: res.status }
      );
    }
    const resource = await res.json();
    return NextResponse.json(resource);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message || "Network error" }, { status: 500 });
  }
}

type FhirIdentifier = {
  system?: string;
  value?: string;
  assigner?: { display?: string };
};

type FhirPatient = {
  resourceType: string;
  id?: string;
  identifier?: FhirIdentifier[];
  [key: string]: unknown;
};

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as {
      ahv?: string;
      ik?: string;
      vnr?: string;
      veka?: string;
      insurerName?: string;
    };

    // Fetch current patient from FHIR
    const getUrl = `${FHIR_BASE}/Patient/${encodeURIComponent(id)}`;
    const getRes = await fetch(getUrl, {
      headers: { accept: "application/fhir+json" },
      cache: "no-store",
    });
    if (!getRes.ok) {
      return NextResponse.json({ error: `FHIR error: ${getRes.status}` }, { status: getRes.status });
    }
    const patient = (await getRes.json()) as FhirPatient;

    // Keep existing identifiers that are NOT the ones we manage
    const managedSystems = [
      "2.16.756.5.32",
      "2.16.756.5.30.1.123.100.1.1",
      FHIR_SYSTEMS.ik,
      FHIR_SYSTEMS.vnr,
    ];
    const kept = (patient.identifier || []).filter(
      (i: FhirIdentifier) => !managedSystems.some((s) => (i.system || "") === s || (i.system || "").includes(s))
    );

    // Build updated identifiers
    const updated: FhirIdentifier[] = [...kept];
    if (body.ahv)
      updated.push({ system: EnvConfig.fhirSystems.ahv, value: body.ahv });
    if (body.veka)
      updated.push({ system: EnvConfig.fhirSystems.veka, value: body.veka });
    if (body.ik)
      updated.push({
        system: FHIR_SYSTEMS.ik,
        value: body.ik,
        ...(body.insurerName ? { assigner: { display: body.insurerName } } : {}),
      });
    if (body.vnr)
      updated.push({ system: FHIR_SYSTEMS.vnr, value: body.vnr });

    const updatedPatient: FhirPatient = { ...patient, identifier: updated };

    const putRes = await fetch(getUrl, {
      method: "PUT",
      headers: {
        "content-type": "application/fhir+json",
        accept: "application/fhir+json",
      },
      body: JSON.stringify(updatedPatient),
    });
    if (!putRes.ok) {
      return NextResponse.json({ error: `FHIR error: ${putRes.status}` }, { status: putRes.status });
    }
    const saved = await putRes.json();
    return NextResponse.json(saved);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message || "Network error" }, { status: 500 });
  }
}
