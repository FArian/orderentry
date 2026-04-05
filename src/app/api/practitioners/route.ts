import { NextResponse } from "next/server";
import { FHIR_BASE } from "@/lib/fhir";
import { getSessionFromCookies } from "@/lib/auth";
import { getUserById } from "@/lib/userStore";
import { createLogger } from "@/infrastructure/logging/Logger";

const log = createLogger("practitioners");

type FhirHumanName = {
  use?: string;
  text?: string;
  given?: string[];
  family?: string;
  prefix?: string[];
};

type FhirPractitioner = {
  resourceType: "Practitioner";
  id?: string;
  name?: FhirHumanName[];
};

type FhirPractitionerRole = {
  resourceType: "PractitionerRole";
  practitioner?: { reference?: string };
};

type FhirBundleEntry = {
  resource?: FhirPractitioner | FhirPractitionerRole;
};

type FhirBundle = {
  resourceType: "Bundle";
  entry?: FhirBundleEntry[];
};

function nameToString(n?: FhirHumanName[]): string {
  if (!n || n.length === 0) return "";
  const first = n[0];
  if (!first) return "";
  if (first.text?.trim()) return first.text.trim();
  const parts = [
    ...(first.prefix || []),
    ...(first.given || []),
    first.family || "",
  ].filter(Boolean);
  return parts.join(" ") || "";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();

  // orgFhirId priority:
  // 1. Explicit query param (patient's managing organization — most accurate)
  // 2. Logged-in user's org (for external Auftraggeber without patient context)
  // 3. undefined → unfiltered (admin / internal lab users)
  let orgFhirId: string | undefined = searchParams.get("orgFhirId") || undefined;

  if (!orgFhirId) {
    try {
      const session = await getSessionFromCookies();
      if (session?.sub) {
        const user = await getUserById(session.sub);
        const isAdmin = user?.role === "admin";
        orgFhirId = isAdmin ? undefined : (user?.profile?.orgFhirId || undefined);
      }
    } catch (err: unknown) {
      // Session or store unavailable — fall back to unfiltered list
      log.warn("session lookup failed, using unfiltered practitioner list", { message: err instanceof Error ? err.message : String(err) });
    }
  }

  try {
    let data: { id: string; name: string }[];

    if (orgFhirId) {
      // Fetch PractitionerRole resources for this org and include linked Practitioners
      const url = new URL(`${FHIR_BASE}/PractitionerRole`);
      url.searchParams.set("organization", `Organization/${orgFhirId}`);
      url.searchParams.set("_include", "PractitionerRole:practitioner");
      url.searchParams.set("_count", "50");
      if (q) url.searchParams.set("practitioner.name", q);

      const res = await fetch(url.toString(), {
        headers: { accept: "application/fhir+json" },
        cache: "no-store",
      });
      if (!res.ok) {
        return NextResponse.json({ data: [] }, { status: res.status });
      }
      const bundle = (await res.json()) as FhirBundle;

      // Collect practitioner IDs referenced by these roles
      const linkedIds = new Set<string>();
      for (const entry of bundle.entry ?? []) {
        const r = entry.resource;
        if (r?.resourceType === "PractitionerRole") {
          const ref = (r as FhirPractitionerRole).practitioner?.reference;
          if (ref) {
            const id = ref.split("/").pop();
            if (id) linkedIds.add(id);
          }
        }
      }

      data = (bundle.entry ?? [])
        .map((e) => e.resource)
        .filter(
          (r): r is FhirPractitioner =>
            !!r && r.resourceType === "Practitioner" && !!r.id && linkedIds.has(r.id),
        )
        .map((p) => ({ id: p.id as string, name: nameToString(p.name) }))
        .filter((p) => p.name);
    } else {
      // No org assigned — show all practitioners (fallback)
      const url = new URL(`${FHIR_BASE}/Practitioner`);
      if (q) url.searchParams.set("name", q);
      url.searchParams.set("_count", "20");

      const res = await fetch(url.toString(), {
        headers: { accept: "application/fhir+json" },
        cache: "no-store",
      });
      if (!res.ok) {
        return NextResponse.json({ data: [] }, { status: res.status });
      }
      const bundle = (await res.json()) as FhirBundle;
      data = (bundle.entry ?? [])
        .map((e) => e.resource)
        .filter(
          (r): r is FhirPractitioner =>
            !!r && r.resourceType === "Practitioner" && !!r.id,
        )
        .map((p) => ({ id: p.id as string, name: nameToString(p.name) }))
        .filter((p) => p.name);
    }

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ data: [], error: message }, { status: 500 });
  }
}
