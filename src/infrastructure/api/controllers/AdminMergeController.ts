/**
 * AdminMergeController — detects and merges duplicate FHIR registry entries.
 *
 * Duplicates are defined as two or more resources sharing the same GLN.
 * The GLN is the canonical reference key for both Organizations and Practitioners.
 *
 * Organization merge (keepId → deleteId):
 *   1. Find all PractitionerRoles that reference the deleted org.
 *   2. PUT each role updated to reference the kept org.
 *   3. DELETE the duplicate Organization.
 *
 * Practitioner merge (keepRoleId → deleteRoleId):
 *   1. DELETE the duplicate PractitionerRole.
 *   2. DELETE the duplicate Practitioner resource (only if no remaining roles reference it).
 */

import { FHIR_BASE } from "@/infrastructure/fhir/FhirClient";
import { EnvConfig } from "@/infrastructure/config/EnvConfig";
import { createLogger } from "@/infrastructure/logging/Logger";

const log = createLogger("AdminMergeController");
import { fhirOrganizationsController, type FhirOrganization } from "./FhirOrganizationsController";
import { fhirPractitionersController, type FhirPractitioner, type FhirPractitionerRole as FhirRole } from "./FhirPractitionersController";
import type { FhirOrganizationDto, FhirPractitionerDto } from "../dto/FhirRegistryDto";
import type { FhirBundle } from "@/infrastructure/fhir/FhirTypes";

// ── DTOs ───────────────────────────────────────────────────────────────────────

export interface DuplicateOrgGroup {
  gln:  string;
  orgs: FhirOrganizationDto[];
}

export interface DuplicatePractGroup {
  gln:    string;
  practs: FhirPractitionerDto[];
}

export interface AdminMergeStatusDto {
  total:       number;
  orgGroups:   DuplicateOrgGroup[];
  practGroups: DuplicatePractGroup[];
  httpStatus?: number;
}

export interface MergeOrgsRequestDto {
  keepId:   string;
  deleteId: string;
}

export interface MergePractsRequestDto {
  keepPractitionerRoleId:   string;
  deletePractitionerRoleId: string;
}

export interface MergeResultDto {
  merged:      boolean;
  error?:      string;
  httpStatus?: number;
}

// ── Bundle parsing helpers ────────────────────────────────────────────────────

function parseOrgBundle(bundle: FhirBundle<FhirOrganization>): FhirOrganizationDto[] {
  if (!bundle.entry) return [];
  return bundle.entry
    .map((e) => e.resource)
    .filter((r): r is FhirOrganization => !!r && !!r.id)
    .map((org) => ({
      id:   org.id!,
      name: org.name ?? "",
      gln:  org.identifier?.find((i) => i.system === EnvConfig.fhirSystems.gln)?.value ?? "",
    }));
}

function parsePractBundle(
  bundle: FhirBundle<FhirPractitioner | FhirRole | { resourceType: string; id?: string }>,
): FhirPractitionerDto[] {
  const practsById = new Map<string, FhirPractitioner>();
  const roles: FhirRole[] = [];

  for (const entry of bundle.entry ?? []) {
    const r = entry.resource as Record<string, unknown> | undefined;
    if (!r) continue;
    if (r.resourceType === "Practitioner") {
      const p = r as FhirPractitioner;
      if (p.id) practsById.set(p.id, p);
    } else if (r.resourceType === "PractitionerRole") {
      roles.push(r as FhirRole);
    }
  }

  return roles
    .filter((role) => !!role.id)
    .map((role) => {
      const practRef = role.practitioner?.reference ?? "";
      const practId  = practRef.split("/").at(-1) ?? "";
      const orgRef   = role.organization?.reference ?? "";
      const orgId    = orgRef.split("/").at(-1) ?? "";
      const pract    = practsById.get(practId);
      const name     = pract?.name?.[0];
      return {
        id:                 pract?.id ?? practId,
        firstName:          name?.given?.[0] ?? "",
        lastName:           name?.family ?? "",
        gln:                pract?.identifier?.find((i) => i.system === EnvConfig.fhirSystems.gln)?.value ?? "",
        organizationId:     orgId,
        organizationName:   "",
        roleCode:           (role.code?.[0] as { coding?: Array<{ code?: string; display?: string }> } | undefined)?.coding?.[0]?.code ?? "",
        roleDisplay:        (role.code?.[0] as { coding?: Array<{ code?: string; display?: string }>; text?: string } | undefined)?.coding?.[0]?.display ?? (role.code?.[0] as { text?: string } | undefined)?.text ?? "",
        practitionerRoleId: role.id!,
      };
    });
}

// ── Controller ─────────────────────────────────────────────────────────────────

export class AdminMergeController {
  constructor(
    private readonly fhirBase: string = FHIR_BASE,
    private readonly fetchFn: typeof globalThis.fetch = globalThis.fetch,
  ) {}

  // ── Status (list duplicates) ─────────────────────────────────────────────────

  async status(): Promise<AdminMergeStatusDto> {
    const [orgsResult, practsResult] = await Promise.all([
      fhirOrganizationsController.list(),
      fhirPractitionersController.list(),
    ]);

    const orgs   = parseOrgBundle(orgsResult as FhirBundle<FhirOrganization>);
    const practs = parsePractBundle(practsResult as FhirBundle<FhirPractitioner | FhirRole | { resourceType: string; id?: string }>);

    const orgGroups   = this.findOrgDuplicates(orgs);
    const practGroups = this.findPractDuplicates(practs);
    const total       = orgGroups.length + practGroups.length;

    return { total, orgGroups, practGroups };
  }

  private findOrgDuplicates(orgs: FhirOrganizationDto[]): DuplicateOrgGroup[] {
    const byGln = new Map<string, FhirOrganizationDto[]>();
    for (const org of orgs) {
      const gln = org.gln?.trim();
      if (!gln) continue;
      const group = byGln.get(gln) ?? [];
      group.push(org);
      byGln.set(gln, group);
    }
    return [...byGln.entries()]
      .filter(([, g]) => g.length > 1)
      .map(([gln, orgs]) => ({ gln, orgs }));
  }

  private findPractDuplicates(practs: FhirPractitionerDto[]): DuplicatePractGroup[] {
    // Duplicate = same GLN AND same organization (different orgs are legitimate PractitionerRoles)
    const byGlnOrg = new Map<string, FhirPractitionerDto[]>();
    for (const p of practs) {
      const gln = p.gln?.trim();
      if (!gln) continue;
      const key   = `${gln}|${p.organizationId ?? ""}`;
      const group = byGlnOrg.get(key) ?? [];
      group.push(p);
      byGlnOrg.set(key, group);
    }
    // Re-group by GLN for display — only include GLNs that have at least one org-collision
    const byGln = new Map<string, FhirPractitionerDto[]>();
    for (const [key, group] of byGlnOrg.entries()) {
      if (group.length < 2) continue;
      const gln = key.split("|")[0]!;
      byGln.set(gln, [...(byGln.get(gln) ?? []), ...group]);
    }
    return [...byGln.entries()].map(([gln, practs]) => ({ gln, practs }));
  }

  // ── Merge organisations ──────────────────────────────────────────────────────

  async mergeOrgs(dto: MergeOrgsRequestDto): Promise<MergeResultDto> {
    const { keepId, deleteId } = dto;
    if (!keepId?.trim() || !deleteId?.trim()) return { merged: false, error: "keepId and deleteId are required", httpStatus: 400 };
    if (keepId === deleteId)                  return { merged: false, error: "keepId and deleteId must differ",    httpStatus: 400 };

    try {
      // 1. Find all PractitionerRoles referencing the duplicate org
      const rolesRes = await this.fetchFn(
        `${this.fhirBase}/PractitionerRole?organization=Organization/${deleteId}&_count=200`,
        { headers: { accept: "application/fhir+json" }, cache: "no-store" },
      );
      if (!rolesRes.ok) return { merged: false, error: `FHIR ${rolesRes.status} fetching roles`, httpStatus: 502 };

      const bundle = (await rolesRes.json()) as FhirBundle;
      const roles  = (bundle.entry ?? [])
        .map((e) => e.resource as FhirRole | undefined)
        .filter((r): r is FhirRole => r?.resourceType === "PractitionerRole" && !!r.id);

      // 2. Remap each role to the kept org
      await Promise.all(roles.map((role) => {
        const updated = { ...role, organization: { reference: `Organization/${keepId}` } };
        return this.fetchFn(`${this.fhirBase}/PractitionerRole/${role.id!}`, {
          method:  "PUT",
          headers: { "content-type": "application/fhir+json", accept: "application/fhir+json" },
          body:    JSON.stringify(updated),
          cache:   "no-store",
        });
      }));

      // 3. Remove partOf references pointing to the deleted org (prevents HAPI 409)
      const partOfRes = await this.fetchFn(
        `${this.fhirBase}/Organization?partof=Organization/${deleteId}&_count=200`,
        { headers: { accept: "application/fhir+json" }, cache: "no-store" },
      );
      if (partOfRes.ok) {
        const partOfBundle = (await partOfRes.json()) as FhirBundle;
        const childOrgs = (partOfBundle.entry ?? [])
          .map((e) => e.resource as FhirOrganization | undefined)
          .filter((r): r is FhirOrganization => r?.resourceType === "Organization" && !!r.id);
        await Promise.all(childOrgs.map((child) => {
          const { partOf: _removed, ...updated } = child as FhirOrganization & { partOf?: unknown };
          return this.fetchFn(`${this.fhirBase}/Organization/${child.id!}`, {
            method:  "PUT",
            headers: { "content-type": "application/fhir+json", accept: "application/fhir+json" },
            body:    JSON.stringify(updated),
            cache:   "no-store",
          });
        }));
      }

      // 4. Delete the duplicate org
      const delRes = await this.fetchFn(`${this.fhirBase}/Organization/${deleteId}`, {
        method: "DELETE",
        headers: { accept: "application/fhir+json" },
        cache: "no-store",
      });
      if (!delRes.ok && delRes.status !== 404) {
        return { merged: false, error: `FHIR ${delRes.status} deleting org`, httpStatus: 502 };
      }

      return { merged: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Merge failed";
      log.error("mergeOrgs failed", { keepId, deleteId, message });
      return { merged: false, error: message, httpStatus: 500 };
    }
  }

  // ── Merge practitioners ──────────────────────────────────────────────────────

  async mergePracts(dto: MergePractsRequestDto): Promise<MergeResultDto> {
    const { keepPractitionerRoleId, deletePractitionerRoleId } = dto;
    if (!keepPractitionerRoleId?.trim() || !deletePractitionerRoleId?.trim()) {
      return { merged: false, error: "Both role IDs are required", httpStatus: 400 };
    }
    if (keepPractitionerRoleId === deletePractitionerRoleId) {
      return { merged: false, error: "Role IDs must differ", httpStatus: 400 };
    }

    try {
      // 1. Fetch the duplicate role to get the Practitioner reference before deleting
      const roleRes = await this.fetchFn(`${this.fhirBase}/PractitionerRole/${deletePractitionerRoleId}`, {
        headers: { accept: "application/fhir+json" },
        cache: "no-store",
      });
      let deletePractId: string | null = null;
      if (roleRes.ok) {
        const role = (await roleRes.json()) as FhirRole;
        const ref  = role.practitioner?.reference ?? "";
        deletePractId = ref.split("/").at(-1) ?? null;
      }

      // 2. Delete the duplicate PractitionerRole
      const delRoleRes = await this.fetchFn(`${this.fhirBase}/PractitionerRole/${deletePractitionerRoleId}`, {
        method: "DELETE",
        headers: { accept: "application/fhir+json" },
        cache: "no-store",
      });
      if (!delRoleRes.ok && delRoleRes.status !== 404) {
        return { merged: false, error: `FHIR ${delRoleRes.status} deleting PractitionerRole`, httpStatus: 502 };
      }

      // 3. Delete the duplicate Practitioner if no other roles reference it
      if (deletePractId) {
        const remainingRes = await this.fetchFn(
          `${this.fhirBase}/PractitionerRole?practitioner=Practitioner/${deletePractId}&_count=1`,
          { headers: { accept: "application/fhir+json" }, cache: "no-store" },
        );
        if (remainingRes.ok) {
          const b = (await remainingRes.json()) as FhirBundle;
          const hasRemainingRoles = (b.total ?? b.entry?.length ?? 0) > 0;
          if (!hasRemainingRoles) {
            await this.fetchFn(`${this.fhirBase}/Practitioner/${deletePractId}`, {
              method: "DELETE",
              headers: { accept: "application/fhir+json" },
              cache: "no-store",
            });
          }
        }
      }

      return { merged: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Merge failed";
      log.error("mergePracts failed", { keepPractitionerRoleId, deletePractitionerRoleId, message });
      return { merged: false, error: message, httpStatus: 500 };
    }
  }
}

export const adminMergeController = new AdminMergeController();
