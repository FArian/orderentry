/**
 * FhirPractitionersController — manages FHIR Practitioner resources.
 *
 * Rules enforced:
 *   - GLN is required on create
 *   - GLN must be unique
 *   - Organization must exist (id validated by caller via select)
 *   - PractitionerRole is required
 *
 * Writes a transaction bundle: Practitioner + PractitionerRole (linked to org).
 * Uses deterministic IDs so repeated creates are safe idempotent upserts.
 */

import { FHIR_BASE } from "@/infrastructure/fhir/FhirClient";
import type {
  CreatePractitionerRequestDto,
  FhirPractitionerDto,
  FhirRegistryErrorDto,
  ListPractitionersResponseDto,
} from "../dto/FhirRegistryDto";

const GLN_SYSTEM  = "urn:oid:2.51.1.3";
const ROLE_SYSTEM = "urn:oid:2.51.1.3.roleType";

// ── FHIR minimal types ─────────────────────────────────────────────────────────

interface FhirIdentifier  { system?: string; value?: string }
interface FhirHumanName   { family?: string; given?: string[] }
interface FhirReference   { reference?: string }
interface FhirCoding      { system?: string; code?: string }
interface FhirCodeableConcept { coding?: FhirCoding[]; text?: string }

interface FhirPractitioner {
  id?:         string;
  identifier?: FhirIdentifier[];
  name?:       FhirHumanName[];
}
interface FhirPractitionerRole {
  id?:           string;
  practitioner?: FhirReference;
  organization?: FhirReference;
  code?:         FhirCodeableConcept[];
}
interface FhirBundleEntry {
  resource?: FhirPractitioner | FhirPractitionerRole | { id?: string; name?: string };
}
interface FhirBundle { entry?: FhirBundleEntry[]; total?: number }

// ── Helpers ────────────────────────────────────────────────────────────────────

function extractId(ref?: string): string {
  if (!ref) return "";
  const parts = ref.split("/");
  return parts[parts.length - 1] ?? "";
}

function extractGln(identifiers?: FhirIdentifier[]): string {
  return identifiers?.find((i) => i.system === GLN_SYSTEM)?.value ?? "";
}

// ── Controller ─────────────────────────────────────────────────────────────────

export class FhirPractitionersController {
  constructor(
    private readonly fhirBase: string = FHIR_BASE,
    private readonly fetchFn: typeof globalThis.fetch = globalThis.fetch,
  ) {}

  async list(): Promise<ListPractitionersResponseDto | FhirRegistryErrorDto> {
    try {
      // Fetch PractitionerRole resources with included Practitioner + Organization
      const url = `${this.fhirBase}/PractitionerRole?_count=200&_include=PractitionerRole:practitioner&_include=PractitionerRole:organization`;
      const res = await this.fetchFn(url, {
        headers: { accept: "application/fhir+json" },
        cache: "no-store",
      });
      if (!res.ok) {
        return { error: `FHIR ${res.status}`, httpStatus: 502 };
      }
      const bundle = (await res.json()) as FhirBundle;

      // Separate entries by resourceType
      const orgsById    = new Map<string, { id: string; name: string }>();
      const practsById  = new Map<string, FhirPractitioner>();
      const roles: FhirPractitionerRole[] = [];

      for (const entry of bundle.entry ?? []) {
        const r = entry.resource as Record<string, unknown> | undefined;
        if (!r) continue;
        if (r.resourceType === "Organization") {
          const org = r as { id?: string; name?: string };
          if (org.id) orgsById.set(org.id, { id: org.id, name: org.name ?? "" });
        } else if (r.resourceType === "Practitioner") {
          const p = r as FhirPractitioner;
          if (p.id) practsById.set(p.id, p);
        } else if (r.resourceType === "PractitionerRole") {
          roles.push(r as FhirPractitionerRole);
        }
      }

      const practitioners: FhirPractitionerDto[] = [];
      for (const role of roles) {
        const practId = extractId(role.practitioner?.reference);
        const orgId   = extractId(role.organization?.reference);
        const pract   = practsById.get(practId);
        const org     = orgsById.get(orgId);
        if (!pract || !role.id) continue;

        const name = pract.name?.[0];
        practitioners.push({
          id:                 pract.id ?? practId,
          firstName:          name?.given?.[0] ?? "",
          lastName:           name?.family ?? "",
          gln:                extractGln(pract.identifier),
          organizationId:     orgId,
          organizationName:   org?.name ?? orgId,
          roleCode:           role.code?.[0]?.coding?.[0]?.code ?? "",
          practitionerRoleId: role.id,
        });
      }

      return { practitioners, total: practitioners.length };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : "List failed", httpStatus: 500 };
    }
  }

  async create(
    dto: CreatePractitionerRequestDto,
  ): Promise<FhirPractitionerDto | FhirRegistryErrorDto> {
    const { firstName, lastName, gln, organizationId, roleCode } = dto;

    if (!gln?.trim())            return { error: "GLN is required",          httpStatus: 400 };
    if (!firstName?.trim())      return { error: "First name is required",   httpStatus: 400 };
    if (!lastName?.trim())       return { error: "Last name is required",    httpStatus: 400 };
    if (!organizationId?.trim()) return { error: "Organization is required", httpStatus: 400 };
    if (!roleCode?.trim())       return { error: "Role is required",         httpStatus: 400 };

    // GLN uniqueness check
    const existing = await this.findByGln(gln.trim());
    if (existing) {
      return { error: "GLN already registered", httpStatus: 409 };
    }

    const safeGln   = gln.trim().replace(/[^a-zA-Z0-9]/g, "-");
    const practId   = `pract-${safeGln}`;
    const roleId    = `role-${safeGln}`;

    const practitioner = {
      resourceType: "Practitioner",
      id:           practId,
      identifier:   [{ system: GLN_SYSTEM, value: gln.trim() }],
      name: [{
        use:    "official",
        family: lastName.trim(),
        given:  [firstName.trim()],
      }],
      active: true,
    };

    const practitionerRole = {
      resourceType:  "PractitionerRole",
      id:            roleId,
      active:        true,
      practitioner:  { reference: `Practitioner/${practId}` },
      organization:  { reference: `Organization/${organizationId.trim()}` },
      code: [{
        coding: [{ system: ROLE_SYSTEM, code: roleCode.trim() }],
        text:   roleCode.trim(),
      }],
    };

    const bundle = {
      resourceType: "Bundle",
      type:         "transaction",
      entry: [
        {
          fullUrl:  `${this.fhirBase}/Practitioner/${practId}`,
          resource: practitioner,
          request:  { method: "PUT", url: `Practitioner/${practId}` },
        },
        {
          fullUrl:  `${this.fhirBase}/PractitionerRole/${roleId}`,
          resource: practitionerRole,
          request:  { method: "PUT", url: `PractitionerRole/${roleId}` },
        },
      ],
    };

    try {
      const res = await this.fetchFn(`${this.fhirBase}/`, {
        method: "POST",
        headers: {
          "content-type": "application/fhir+json",
          accept: "application/fhir+json",
        },
        body: JSON.stringify(bundle),
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { error: `FHIR ${res.status}: ${text.slice(0, 200)}`, httpStatus: 502 };
      }
      return {
        id:                 practId,
        firstName:          firstName.trim(),
        lastName:           lastName.trim(),
        gln:                gln.trim(),
        organizationId:     organizationId.trim(),
        organizationName:   "",   // resolved by list on next fetch
        roleCode:           roleCode.trim(),
        practitionerRoleId: roleId,
      };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : "Create failed", httpStatus: 500 };
    }
  }

  private async findByGln(gln: string): Promise<string | null> {
    try {
      const url = `${this.fhirBase}/Practitioner?identifier=${encodeURIComponent(`${GLN_SYSTEM}|${gln}`)}&_count=1`;
      const res = await this.fetchFn(url, {
        headers: { accept: "application/fhir+json" },
        cache: "no-store",
      });
      if (!res.ok) return null;
      const bundle = (await res.json()) as FhirBundle;
      const entry = bundle.entry?.[0]?.resource as { id?: string } | undefined;
      return entry?.id ?? null;
    } catch {
      return null;
    }
  }
}

export const fhirPractitionersController = new FhirPractitionersController();
