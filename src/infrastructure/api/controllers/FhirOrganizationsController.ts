/**
 * FhirOrganizationsController — manages FHIR Organization resources.
 *
 * Rules enforced:
 *   - GLN is required on create
 *   - GLN must be unique (searched before write)
 *
 * Uses deterministic FHIR IDs (org-{gln}) so PUT is idempotent upsert.
 * Constructor-injectable fetchFn for testability.
 */

import { FHIR_BASE } from "@/infrastructure/fhir/FhirClient";
import { getAdminSession } from "@/lib/auth";
import type {
  CreateOrganizationRequestDto,
  FhirOrganizationDto,
  FhirRegistryErrorDto,
  ListOrganizationsResponseDto,
} from "../dto/FhirRegistryDto";

const GLN_SYSTEM = "urn:oid:2.51.1.3";

// ── FHIR types (minimal) ───────────────────────────────────────────────────────

interface FhirIdentifier { system?: string; value?: string }
interface FhirOrg {
  id?:         string;
  name?:       string;
  identifier?: FhirIdentifier[];
}
interface FhirBundle { entry?: { resource?: FhirOrg }[]; total?: number }

// ── Helper ─────────────────────────────────────────────────────────────────────

function extractGln(org: FhirOrg): string {
  return (
    org.identifier?.find((i) => i.system === GLN_SYSTEM)?.value ?? ""
  );
}

function toDto(org: FhirOrg): FhirOrganizationDto | null {
  if (!org.id) return null;
  return {
    id:   org.id,
    name: org.name ?? "",
    gln:  extractGln(org),
  };
}

// ── Controller ─────────────────────────────────────────────────────────────────

export class FhirOrganizationsController {
  constructor(
    private readonly fhirBase: string = FHIR_BASE,
    private readonly fetchFn: typeof globalThis.fetch = globalThis.fetch,
  ) {}

  async list(): Promise<ListOrganizationsResponseDto | FhirRegistryErrorDto> {
    try {
      const url = `${this.fhirBase}/Organization?_count=200&_sort=name`;
      const res = await this.fetchFn(url, {
        headers: { accept: "application/fhir+json" },
        cache: "no-store",
      });
      if (!res.ok) {
        return { error: `FHIR ${res.status}`, httpStatus: 502 };
      }
      const bundle = (await res.json()) as FhirBundle;
      const organizations = (bundle.entry ?? [])
        .map((e) => (e.resource ? toDto(e.resource) : null))
        .filter((x): x is FhirOrganizationDto => x !== null);
      return { organizations, total: organizations.length };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : "List failed", httpStatus: 500 };
    }
  }

  async create(
    dto: CreateOrganizationRequestDto,
  ): Promise<FhirOrganizationDto | FhirRegistryErrorDto> {
    const { name, gln } = dto;
    if (!gln?.trim())  return { error: "GLN is required",  httpStatus: 400 };
    if (!name?.trim()) return { error: "Name is required", httpStatus: 400 };

    // GLN uniqueness check
    const existing = await this.findByGln(gln.trim());
    if (existing) {
      return { error: "GLN already registered", httpStatus: 409 };
    }

    const id  = `org-${gln.trim().replace(/[^a-zA-Z0-9]/g, "-")}`;
    const org = {
      resourceType: "Organization",
      id,
      identifier: [{ system: GLN_SYSTEM, value: gln.trim() }],
      name: name.trim(),
      active: true,
    };

    try {
      const res = await this.fetchFn(`${this.fhirBase}/Organization/${id}`, {
        method: "PUT",
        headers: {
          "content-type": "application/fhir+json",
          accept: "application/fhir+json",
        },
        body: JSON.stringify(org),
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { error: `FHIR ${res.status}: ${text.slice(0, 200)}`, httpStatus: 502 };
      }
      return { id, name: name.trim(), gln: gln.trim() };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : "Create failed", httpStatus: 500 };
    }
  }

  private async findByGln(gln: string): Promise<string | null> {
    try {
      const url = `${this.fhirBase}/Organization?identifier=${encodeURIComponent(`${GLN_SYSTEM}|${gln}`)}&_count=1`;
      const res = await this.fetchFn(url, {
        headers: { accept: "application/fhir+json" },
        cache: "no-store",
      });
      if (!res.ok) return null;
      const bundle = (await res.json()) as FhirBundle;
      return bundle.entry?.[0]?.resource?.id ?? null;
    } catch {
      return null;
    }
  }
}

export const fhirOrganizationsController = new FhirOrganizationsController();

// ── Route auth helper (admin required) ────────────────────────────────────────

export async function requireAdmin(): Promise<{ error: string; httpStatus: number } | null> {
  const session = await getAdminSession();
  if (!session) return { error: "Unauthorized", httpStatus: 401 };
  return null;
}
