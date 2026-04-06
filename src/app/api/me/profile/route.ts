import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getUserById, updateUserProfile } from "@/lib/userStore";
import type { UserProfile } from "@/lib/userStore";
import { fhirBase } from "@/config";
import { EnvConfig } from "@/infrastructure/config/EnvConfig";
import { createLogger } from "@/infrastructure/logging/Logger";

const log = createLogger("me-profile");

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUserById(session.sub);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({
    id: user.id,
    username: user.username,
    createdAt: user.createdAt,
    profile: user.profile ?? {},
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: UserProfile;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const allowed: (keyof UserProfile)[] = [
    "gln", "localId", "ptype", "roleType",
    "firstName", "lastName", "organization",
    "street", "streetNo", "zip", "city", "canton", "country",
    "email", "phone",
    "orgGln", "orgName", "orgFhirId",
  ];
  const clean: UserProfile = {};
  for (const key of allowed) {
    if (key in body && typeof body[key] === "string") {
      (clean as Record<string, string>)[key] = (body[key] as string).trim();
    }
  }

  // Enforce field rules by PTYPE
  if (clean.ptype === "JUR") {
    delete clean.firstName;
    delete clean.lastName;
  }
  if (clean.ptype === "NAT") {
    delete clean.organization;
  }

  try {
    const updated = await updateUserProfile(session.sub, clean);

    // Best-effort FHIR sync (non-blocking)
    syncFhirResources(session.sub, clean).catch((e: unknown) => {
      log.error("FHIR sync failed", { message: e instanceof Error ? e.message : String(e) });
    });

    return NextResponse.json({ profile: updated.profile ?? {} });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Save failed" },
      { status: 500 }
    );
  }
}

// ─── FHIR helpers ────────────────────────────────────────────────────────────

const GLN_SYSTEM      = EnvConfig.fhirSystems.gln;
const LOCAL_ID_SYSTEM = "https://www.zetlab.ch/fhir/identifier/local-id";

type FhirBundle = { entry?: { resource?: { id?: string } }[] };

async function fhirSearch(resourceType: string, params: string): Promise<string | null> {
  const url = `${fhirBase}/${resourceType}?${params}&_count=1`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/fhir+json" }, cache: "no-store" });
    if (!res.ok) return null;
    const bundle = (await res.json()) as FhirBundle;
    return bundle.entry?.[0]?.resource?.id ?? null;
  } catch {
    return null;
  }
}

async function findByGln(resourceType: "Organization" | "Practitioner", gln: string): Promise<string | null> {
  return fhirSearch(resourceType, `identifier=${encodeURIComponent(`${GLN_SYSTEM}|${gln}`)}`);
}

async function findOrgByName(name: string): Promise<string | null> {
  return fhirSearch("Organization", `name=${encodeURIComponent(name)}`);
}

async function findPractitionerByName(family: string, given: string): Promise<string | null> {
  return fhirSearch("Practitioner", `family=${encodeURIComponent(family)}&given=${encodeURIComponent(given)}`);
}

/** Find or create a stable FHIR id for an Organisation identified by orgGln.
 *  Returns the FHIR resource id (may or may not already exist on the server). */
async function resolveOrgId(orgGln: string, orgName: string, fallbackId: string): Promise<string> {
  let id = await findByGln("Organization", orgGln);
  if (!id && orgName) id = await findOrgByName(orgName);
  return id ?? fallbackId;
}

function buildIdentifiers(gln?: string, localId?: string) {
  const ids: { system: string; value: string }[] = [];
  if (gln)     ids.push({ system: GLN_SYSTEM,      value: gln });
  if (localId) ids.push({ system: LOCAL_ID_SYSTEM, value: localId });
  return ids;
}

function buildAddress(p: UserProfile) {
  const line = [p.street, p.streetNo].filter(Boolean).join(" ");
  return [{
    ...(line      && { line: [line] }),
    ...(p.zip     && { postalCode: p.zip }),
    ...(p.city    && { city: p.city }),
    ...(p.canton  && { state: p.canton }),
    ...(p.country && { country: p.country }),
  }];
}

function bundleEntry(resource: Record<string, unknown>) {
  const id = resource.id as string;
  const rt = resource.resourceType as string;
  return {
    fullUrl: `${fhirBase}/${rt}/${id}`,
    resource,
    request: { method: "PUT", url: `${rt}/${id}` },
  };
}

async function syncFhirResources(userId: string, p: UserProfile) {
  const isNAT = p.ptype === "NAT";
  const identifiers = buildIdentifiers(p.gln, p.localId);
  const address = buildAddress(p);
  const entries: ReturnType<typeof bundleEntry>[] = [];

  if (isNAT) {
    // ── 1. Resolve Practitioner ID ────────────────────────────────────────
    let practId: string | null = null;
    if (p.gln)                         practId = await findByGln("Practitioner", p.gln);
    if (!practId && p.lastName && p.firstName)
                                        practId = await findPractitionerByName(p.lastName, p.firstName);
    practId = practId ?? `practitioner-${userId}`;

    const practitioner: Record<string, unknown> = {
      resourceType: "Practitioner",
      id: practId,
      ...(identifiers.length > 0 && { identifier: identifiers }),
      name: [{
        use: "official",
        ...(p.lastName  && { family: p.lastName }),
        ...(p.firstName && { given: [p.firstName] }),
      }],
      address,
      ...(p.email && { telecom: [{ system: "email", value: p.email }] }),
    };
    entries.push(bundleEntry(practitioner));

    // ── 2. Resolve linked Organisation ───────────────────────────────────
    // orgGln = the organisation this practitioner belongs to
    let orgId: string;
    if (p.orgGln) {
      orgId = await resolveOrgId(p.orgGln, p.orgName ?? "", `org-${p.orgGln}`);
      // Ensure the org exists in FHIR (upsert with minimal data if not found on server)
      const orgIdentifiers = buildIdentifiers(p.orgGln);
      const org: Record<string, unknown> = {
        resourceType: "Organization",
        id: orgId,
        ...(orgIdentifiers.length > 0 && { identifier: orgIdentifiers }),
        ...(p.orgName && { name: p.orgName }),
      };
      entries.push(bundleEntry(org));
    } else {
      orgId = `org-${userId}`;
    }

    // ── 3. PractitionerRole ───────────────────────────────────────────────
    const roleId = `practitioner-role-${userId}`;
    const practitionerRole: Record<string, unknown> = {
      resourceType: "PractitionerRole",
      id: roleId,
      active: true,
      practitioner: { reference: `Practitioner/${practId}` },
      organization:  { reference: `Organization/${orgId}` },
    };
    if (p.roleType) {
      practitionerRole.code = [{
        coding: [{ system: "urn:oid:2.51.1.3.roleType", code: p.roleType }],
        text: p.roleType,
      }];
    }
    entries.push(bundleEntry(practitionerRole));

  } else {
    // ── JUR: Organisation (with optional partOf) ──────────────────────────
    let orgId: string | null = null;
    if (p.gln)          orgId = await findByGln("Organization", p.gln);
    if (!orgId && p.organization) orgId = await findOrgByName(p.organization);
    orgId = orgId ?? `org-${userId}`;

    const org: Record<string, unknown> = {
      resourceType: "Organization",
      id: orgId,
      ...(identifiers.length > 0 && { identifier: identifiers }),
      ...(p.organization && { name: p.organization }),
      address,
    };

    // orgGln = parent / Dachorganisation
    if (p.orgGln) {
      const parentId = await resolveOrgId(p.orgGln, p.orgName ?? "", `org-${p.orgGln}`);
      org.partOf = { reference: `Organization/${parentId}` };

      // Ensure parent org exists in FHIR
      const parentIdentifiers = buildIdentifiers(p.orgGln);
      const parentOrg: Record<string, unknown> = {
        resourceType: "Organization",
        id: parentId,
        ...(parentIdentifiers.length > 0 && { identifier: parentIdentifiers }),
        ...(p.orgName && { name: p.orgName }),
      };
      entries.push(bundleEntry(parentOrg));
    }

    entries.push(bundleEntry(org));
  }

  const bundle = {
    resourceType: "Bundle",
    type: "transaction",
    entry: entries,
  };

  const res = await fetch(`${fhirBase}`, {
    method: "POST",
    headers: { "Content-Type": "application/fhir+json", Accept: "application/fhir+json" },
    body: JSON.stringify(bundle),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    log.error("FHIR Bundle POST failed", { status: res.status, body: text.slice(0, 300) });
  }
}
