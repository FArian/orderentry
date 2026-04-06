/**
 * FhirOrganizationsController — manages FHIR Organization resources.
 *
 * Rules enforced:
 *   - GLN is required on create
 *   - GLN must be unique (searched before write)
 *
 * Uses deterministic FHIR IDs (org-{gln}) so PUT is idempotent upsert.
 * Constructor-injectable fetchFn for testability.
 *
 * List returns a FHIR searchset Bundle<Organization>.
 * Create/Update return the Organization resource directly.
 * Delete returns a FHIR OperationOutcome.
 * All errors return a FHIR OperationOutcome.
 */

import { FHIR_BASE } from "@/infrastructure/fhir/FhirClient";
import { getAdminSession, getAdminFromRequest } from "@/lib/auth";
import { createLogger } from "@/infrastructure/logging/Logger";

const log = createLogger("FhirOrganizationsController");
import {
  buildOperationOutcome,
  buildSearchBundle,
  type FhirBundle,
  type FhirOperationOutcome,
} from "@/infrastructure/fhir/FhirTypes";

const GLN_SYSTEM = "https://www.gs1.org/gln";

export interface OrgReferenceDto {
  resourceType: string;
  id:           string;
  display:      string;
}

// ── FHIR Organization type ────────────────────────────────────────────────────

export interface FhirOrganization {
  resourceType: "Organization";
  id?:          string;
  name?:        string;
  active?:      boolean;
  identifier?:  Array<{ system?: string; value?: string }>;
  partOf?:      { reference?: string };
}

// ── Controller ─────────────────────────────────────────────────────────────────

export class FhirOrganizationsController {
  constructor(
    private readonly fhirBase: string = FHIR_BASE,
    private readonly fetchFn: typeof globalThis.fetch = globalThis.fetch,
  ) {}

  async list(): Promise<FhirBundle<FhirOrganization> | FhirOperationOutcome> {
    try {
      const url = `${this.fhirBase}/Organization?_count=200&_sort=name`;
      const res = await this.fetchFn(url, {
        headers: { accept: "application/fhir+json" },
        cache: "no-store",
      });
      if (!res.ok) {
        return buildOperationOutcome("error", "exception", `FHIR ${res.status}`, 502);
      }
      const bundle = (await res.json()) as FhirBundle<FhirOrganization>;
      const orgs = (bundle.entry ?? [])
        .map((e) => e.resource)
        .filter((r): r is FhirOrganization => !!r && !!r.id);

      return buildSearchBundle(orgs, orgs.length);
    } catch (err: unknown) {
      log.error("list failed", { message: err instanceof Error ? err.message : String(err) });
      return buildOperationOutcome("error", "exception", err instanceof Error ? err.message : "List failed", 500);
    }
  }

  async create(
    dto: { name: string; gln: string; parentId?: string },
  ): Promise<FhirOrganization | FhirOperationOutcome> {
    const { name, gln, parentId } = dto;
    if (!gln?.trim())  return buildOperationOutcome("error", "required",   "GLN is required",  400);
    if (!name?.trim()) return buildOperationOutcome("error", "required",   "Name is required", 400);

    const existing = await this.findByGln(gln.trim());
    if (existing) {
      return buildOperationOutcome("error", "duplicate", "GLN already registered", 409);
    }

    const id: string  = `org-${gln.trim().replace(/[^a-zA-Z0-9]/g, "-")}`;
    const org: FhirOrganization = {
      resourceType: "Organization",
      id,
      identifier: [{ system: GLN_SYSTEM, value: gln.trim() }],
      name: name.trim(),
      active: true,
      ...(parentId?.trim() ? { partOf: { reference: `Organization/${parentId.trim()}` } } : {}),
    };

    try {
      const res = await this.fetchFn(`${this.fhirBase}/Organization/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/fhir+json", accept: "application/fhir+json" },
        body: JSON.stringify(org),
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return buildOperationOutcome("error", "exception", `FHIR ${res.status}: ${text.slice(0, 200)}`, 502);
      }
      return org;
    } catch (err: unknown) {
      log.error("create failed", { gln, message: err instanceof Error ? err.message : String(err) });
      return buildOperationOutcome("error", "exception", err instanceof Error ? err.message : "Create failed", 500);
    }
  }

  async update(
    id: string,
    dto: { name: string; gln: string; parentId?: string },
  ): Promise<FhirOrganization | FhirOperationOutcome> {
    if (!dto.name?.trim()) return buildOperationOutcome("error", "required", "Name is required", 400);
    const org: FhirOrganization = {
      resourceType: "Organization",
      id,
      identifier: [{ system: GLN_SYSTEM, value: dto.gln.trim() }],
      name: dto.name.trim(),
      active: true,
      ...(dto.parentId?.trim() ? { partOf: { reference: `Organization/${dto.parentId.trim()}` } } : {}),
    };
    try {
      const res = await this.fetchFn(`${this.fhirBase}/Organization/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/fhir+json", accept: "application/fhir+json" },
        body: JSON.stringify(org),
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return buildOperationOutcome("error", "exception", `FHIR ${res.status}: ${text.slice(0, 200)}`, 502);
      }
      return org;
    } catch (err: unknown) {
      log.error("update failed", { id, message: err instanceof Error ? err.message : String(err) });
      return buildOperationOutcome("error", "exception", err instanceof Error ? err.message : "Update failed", 500);
    }
  }

  async delete(id: string): Promise<FhirOperationOutcome> {
    try {
      const res = await this.fetchFn(`${this.fhirBase}/Organization/${id}`, {
        method: "DELETE",
        headers: { accept: "application/fhir+json" },
        cache: "no-store",
      });
      if (res.status === 404) {
        return buildOperationOutcome("error", "not-found", "orgNotFound", 404);
      }
      if (res.status === 409) {
        // HAPI rejects delete when the resource is still referenced by other resources
        log.warn("delete conflict — org still referenced", { id });
        return buildOperationOutcome("error", "conflict", "orgHasReferences", 409);
      }
      if (!res.ok) {
        log.error("delete non-2xx", { id, status: res.status });
        return buildOperationOutcome("error", "exception", "orgDeleteFailed", 502);
      }
      return buildOperationOutcome("information", "informational", `Organization/${id} deleted`, 200);
    } catch (err: unknown) {
      log.error("delete failed", { id, message: err instanceof Error ? err.message : String(err) });
      return buildOperationOutcome("error", "exception", err instanceof Error ? err.message : "Delete failed", 500);
    }
  }

  /**
   * Returns a list of FHIR resources that still reference this organization.
   * Used to explain a 409 conflict to the admin user.
   */
  async references(id: string): Promise<OrgReferenceDto[]> {
    const ref = `Organization/${id}`;
    const searchParams = [
      { type: "Patient",          param: `organization=${ref}` },
      { type: "PractitionerRole", param: `organization=${ref}` },
      { type: "ServiceRequest",   param: `requester=${ref}` },
    ] as const;

    const results = await Promise.all(
      searchParams.map(({ type, param }) =>
        this.fetchFn(
          `${this.fhirBase}/${type}?${param}&_count=5&_summary=true`,
          { headers: { accept: "application/fhir+json" }, cache: "no-store" },
        )
          .then((r) => (r.ok ? r.json() : Promise.resolve({ entry: [] })))
          .then((bundle: FhirBundle<{ resourceType: string; id?: string; name?: Array<{ text?: string; family?: string; given?: string[] }> | string; display?: string }>) =>
            (bundle.entry ?? []).map((e): OrgReferenceDto => {
              const res = e.resource;
              const nameArr = Array.isArray(res?.name) ? res.name : [];
              const display =
                nameArr[0]?.text ||
                [nameArr[0]?.given?.[0], nameArr[0]?.family].filter(Boolean).join(" ") ||
                (typeof res?.name === "string" ? res.name : "") ||
                res?.id ||
                "—";
              return { resourceType: res?.resourceType ?? type, id: res?.id ?? "", display };
            }),
          )
          .catch(() => [] as OrgReferenceDto[]),
      ),
    );

    return results.flat();
  }

  private async findByGln(gln: string): Promise<string | null> {
    // Search both GLN systems: current standard and legacy OID
    const systems = [GLN_SYSTEM, "urn:oid:2.51.1.3"];
    try {
      const results = await Promise.all(systems.map(async (sys) => {
        const url = `${this.fhirBase}/Organization?identifier=${encodeURIComponent(`${sys}|${gln}`)}&_count=1`;
        const res = await this.fetchFn(url, { headers: { accept: "application/fhir+json" }, cache: "no-store" });
        if (!res.ok) return null;
        const bundle = (await res.json()) as FhirBundle<FhirOrganization>;
        return bundle.entry?.[0]?.resource?.id ?? null;
      }));
      return results.find((id) => id !== null) ?? null;
    } catch {
      return null;
    }
  }
}

export const fhirOrganizationsController = new FhirOrganizationsController();

// ── Route auth helper (admin required) ────────────────────────────────────────

/**
 * Auth guard for admin-only routes.
 * Checks session cookie first; falls back to Authorization: Bearer (PAT or JWT).
 * Pass the incoming Request to enable Bearer token auth from external clients.
 */
export async function requireAdmin(
  req?: Request,
): Promise<{ error: string; httpStatus: number } | null> {
  const session = req
    ? await getAdminFromRequest(req)
    : await getAdminSession();
  if (!session) return { error: "Unauthorized", httpStatus: 401 };
  return null;
}
