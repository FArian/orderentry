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
 *
 * List returns the raw FHIR Bundle from HAPI (PractitionerRole + _include resources).
 * Create/Update return the PractitionerRole resource.
 * All errors return a FHIR OperationOutcome.
 */

import { FHIR_BASE } from "@/infrastructure/fhir/FhirClient";
import {
  buildOperationOutcome,
  type FhirBundle,
  type FhirBundleEntry,
  type FhirOperationOutcome,
} from "@/infrastructure/fhir/FhirTypes";
import { createLogger } from "@/infrastructure/logging/Logger";

const log = createLogger("FhirPractitionersController");
import type {
  CreatePractitionerRequestDto,
  UpdatePractitionerRequestDto,
} from "../dto/FhirRegistryDto";
import { EnvConfig } from "@/infrastructure/config/EnvConfig";

const GLN_SYSTEM  = EnvConfig.fhirSystems.gln;
const ROLE_SYSTEM = "urn:oid:2.51.1.3.roleType";

// ── FHIR resource types ────────────────────────────────────────────────────────

export interface FhirPractitioner {
  resourceType: "Practitioner";
  id?:         string;
  identifier?: Array<{ system?: string; value?: string }>;
  name?:       Array<{ use?: string; family?: string; given?: string[] }>;
  [key: string]: unknown;
}

export interface FhirPractitionerRole {
  resourceType:  "PractitionerRole";
  id?:           string;
  active?:       boolean;
  practitioner?: { reference?: string };
  organization?: { reference?: string };
  code?:         Array<{ coding?: Array<{ system?: string; code?: string; display?: string }>; text?: string }>;
  [key: string]: unknown;
}

type BundleResource = FhirPractitioner | FhirPractitionerRole | { resourceType: string; id?: string; name?: string };

// ── Controller ─────────────────────────────────────────────────────────────────

export class FhirPractitionersController {
  constructor(
    private readonly fhirBase: string = FHIR_BASE,
    private readonly fetchFn: typeof globalThis.fetch = globalThis.fetch,
  ) {}

  /** Returns the raw FHIR Bundle from HAPI (PractitionerRole + included Practitioner + Organization). */
  async list(): Promise<FhirBundle<BundleResource> | FhirOperationOutcome> {
    try {
      const url = `${this.fhirBase}/PractitionerRole?_count=200&_include=PractitionerRole:practitioner&_include=PractitionerRole:organization`;
      const res = await this.fetchFn(url, {
        headers: { accept: "application/fhir+json" },
        cache: "no-store",
      });
      if (!res.ok) {
        return buildOperationOutcome("error", "exception", `FHIR ${res.status}`, 502);
      }
      const bundle = (await res.json()) as FhirBundle<BundleResource>;
      return { ...bundle, type: "searchset" as const };
    } catch (err: unknown) {
      log.error("list failed", { message: err instanceof Error ? err.message : String(err) });
      return buildOperationOutcome("error", "exception", err instanceof Error ? err.message : "List failed", 500);
    }
  }

  async create(
    dto: CreatePractitionerRequestDto,
  ): Promise<FhirPractitionerRole | FhirOperationOutcome> {
    const { firstName, lastName, gln, organizationId, roleCode } = dto;

    if (!gln?.trim())            return buildOperationOutcome("error", "required", "GLN is required",          400);
    if (!firstName?.trim())      return buildOperationOutcome("error", "required", "First name is required",   400);
    if (!lastName?.trim())       return buildOperationOutcome("error", "required", "Last name is required",    400);
    if (!organizationId?.trim()) return buildOperationOutcome("error", "required", "Organization is required", 400);
    if (!roleCode?.trim())       return buildOperationOutcome("error", "required", "Role is required",         400);

    const existing = await this.findByGln(gln.trim());
    if (existing) {
      return buildOperationOutcome("error", "duplicate", "GLN already registered", 409);
    }

    const safeGln = gln.trim().replace(/[^a-zA-Z0-9]/g, "-");
    const practId = `pract-${safeGln}`;
    const roleId  = `role-${safeGln}`;

    const practitioner: FhirPractitioner = {
      resourceType: "Practitioner",
      id:           practId,
      identifier:   [{ system: GLN_SYSTEM, value: gln.trim() }],
      name: [{ use: "official", family: lastName.trim(), given: [firstName.trim()] }],
      active: true,
    };

    const practitionerRole: FhirPractitionerRole = {
      resourceType: "PractitionerRole",
      id:           roleId,
      active:       true,
      practitioner: { reference: `Practitioner/${practId}` },
      organization: { reference: `Organization/${organizationId.trim()}` },
      code: [{
        coding: [{ system: ROLE_SYSTEM, code: roleCode.trim() }],
        text:   roleCode.trim(),
      }],
    };

    const transactionBundle = {
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
      ] as FhirBundleEntry<FhirPractitioner | FhirPractitionerRole>[],
    };

    try {
      const res = await this.fetchFn(`${this.fhirBase}/`, {
        method:  "POST",
        headers: { "content-type": "application/fhir+json", accept: "application/fhir+json" },
        body:    JSON.stringify(transactionBundle),
        cache:   "no-store",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return buildOperationOutcome("error", "exception", `FHIR ${res.status}: ${text.slice(0, 200)}`, 502);
      }
      return practitionerRole;
    } catch (err: unknown) {
      log.error("create failed", { message: err instanceof Error ? err.message : String(err) });
      return buildOperationOutcome("error", "exception", err instanceof Error ? err.message : "Create failed", 500);
    }
  }

  async update(
    practitionerRoleId: string,
    dto: UpdatePractitionerRequestDto,
  ): Promise<FhirPractitionerRole | FhirOperationOutcome> {
    const { roleCode, organizationId, gln } = dto;
    if (!practitionerRoleId?.trim()) return buildOperationOutcome("error", "required", "PractitionerRole ID is required", 400);
    if (!roleCode?.trim())           return buildOperationOutcome("error", "required", "Role is required",                 400);
    if (!organizationId?.trim())     return buildOperationOutcome("error", "required", "Organization is required",         400);

    try {
      const getRes = await this.fetchFn(`${this.fhirBase}/PractitionerRole/${practitionerRoleId}`, {
        headers: { accept: "application/fhir+json" },
        cache: "no-store",
      });
      if (!getRes.ok) return buildOperationOutcome("error", "exception", `FHIR ${getRes.status}`, 502);

      const existing = (await getRes.json()) as FhirPractitionerRole;
      const updated: FhirPractitionerRole = {
        ...existing,
        organization: { reference: `Organization/${organizationId.trim()}` },
        code: [{
          coding: [{ system: ROLE_SYSTEM, code: roleCode.trim() }],
          text:   roleCode.trim(),
        }],
      };

      const putRes = await this.fetchFn(`${this.fhirBase}/PractitionerRole/${practitionerRoleId}`, {
        method:  "PUT",
        headers: { "content-type": "application/fhir+json", accept: "application/fhir+json" },
        body:    JSON.stringify(updated),
        cache:   "no-store",
      });
      if (!putRes.ok) {
        const text = await putRes.text().catch(() => "");
        return buildOperationOutcome("error", "exception", `FHIR ${putRes.status}: ${text.slice(0, 200)}`, 502);
      }

      // If a new GLN is provided, also update the Practitioner resource
      if (gln?.trim()) {
        const practRef = existing.practitioner?.reference ?? "";
        const practId  = practRef.split("/").at(-1) ?? "";
        if (practId) {
          const practRes = await this.fetchFn(`${this.fhirBase}/Practitioner/${practId}`, {
            headers: { accept: "application/fhir+json" },
            cache: "no-store",
          });
          if (practRes.ok) {
            const practResource = (await practRes.json()) as FhirPractitioner;
            const others = (practResource.identifier ?? []).filter((i) => i.system !== GLN_SYSTEM);
            practResource.identifier = [...others, { system: GLN_SYSTEM, value: gln.trim() }];
            await this.fetchFn(`${this.fhirBase}/Practitioner/${practId}`, {
              method:  "PUT",
              headers: { "content-type": "application/fhir+json", accept: "application/fhir+json" },
              body:    JSON.stringify(practResource),
              cache:   "no-store",
            });
          }
        }
      }

      return { ...updated, id: practitionerRoleId };
    } catch (err: unknown) {
      log.error("update failed", { message: err instanceof Error ? err.message : String(err) });
      return buildOperationOutcome("error", "exception", err instanceof Error ? err.message : "Update failed", 500);
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
      const bundle = (await res.json()) as FhirBundle<FhirPractitioner>;
      return bundle.entry?.[0]?.resource?.id ?? null;
    } catch {
      return null;
    }
  }
}

export const fhirPractitionersController = new FhirPractitionersController();
