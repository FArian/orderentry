/**
 * PractitionerMapper — maps ManagedUser profiles to FHIR resources.
 *
 * Creates or updates:
 *   NAT (person)  → Practitioner + PractitionerRole + linked Organization
 *   JUR (org)     → Organization (with optional partOf)
 *
 * All operations use FHIR transaction bundles (PUT = idempotent upsert).
 * Accepts an injectable fetchFn for testability.
 *
 * Returns the FHIR IDs of the created/updated resources so they can be
 * stored back on the ManagedUser (fhirPractitionerId, fhirPractitionerRoleId).
 */

import { FHIR_BASE } from "./FhirClient";
import { createLogger, type Logger } from "../logging/Logger";
import { EnvConfig } from "../config/EnvConfig";
import type { ManagedUserProfile } from "@/domain/entities/ManagedUser";

// ── Constants ─────────────────────────────────────────────────────────────────

const LOCAL_ID_SYSTEM = "https://www.zetlab.ch/fhir/identifier/local-id";
const ROLE_SYSTEM     = "urn:oid:2.51.1.3.roleType";
const LAB_ORG_ID      = process.env.NEXT_PUBLIC_LAB_ORG_ID ?? "zlz"; // Auftragnehmer (Labor)

// FHIR system URIs — configurable via ENV (FHIR_SYSTEM_GLN, FHIR_SYSTEM_ZSR, etc.)
const { gln: GLN_SYSTEM, zsr: ZSR_SYSTEM, uid: UID_SYSTEM, bur: BUR_SYSTEM } = EnvConfig.fhirSystems;

// ── Result type ───────────────────────────────────────────────────────────────

export interface PractitionerSyncResult {
  success: boolean;
  practitionerId?: string;
  practitionerRoleId?: string;
  organizationId?: string;
  error?: string;
}

// ── FHIR resource shapes (minimal) ───────────────────────────────────────────

type FhirBundle = { entry?: { resource?: { id?: string } }[] };
type FhirEntry  = { fullUrl: string; resource: Record<string, unknown>; request: { method: string; url: string } };

// ── PractitionerMapper ────────────────────────────────────────────────────────

export class PractitionerMapper {
  private readonly log: Logger;

  constructor(
    private readonly fhirBase: string = FHIR_BASE,
    private readonly fetchFn: typeof globalThis.fetch = globalThis.fetch,
    logger?: Logger,
  ) {
    this.log = logger ?? createLogger("PractitionerMapper");
  }

  // ── Public entry point ──────────────────────────────────────────────────────

  async syncUser(userId: string, profile: ManagedUserProfile): Promise<PractitionerSyncResult> {
    if (!profile.ptype) {
      return { success: false, error: "profile.ptype is required (NAT, JUR or PER)" };
    }

    try {
      if (profile.ptype === "NAT") return await this.syncNAT(userId, profile);
      if (profile.ptype === "JUR") return await this.syncJUR(userId, profile);
      return await this.syncPER(userId, profile);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error("PractitionerMapper syncUser threw", { userId, message });
      return { success: false, error: message };
    }
  }

  // ── NAT: Practitioner + PractitionerRole + linked Organization ──────────────

  private async syncNAT(userId: string, p: ManagedUserProfile): Promise<PractitionerSyncResult> {
    // 1. Resolve Practitioner ID
    let practId = await this.findByGln("Practitioner", p.gln);
    if (!practId && p.lastName && p.firstName)
      practId = await this.findPractitionerByName(p.lastName, p.firstName);
    practId = practId ?? `practitioner-${userId}`;

    // 2. Resolve linked Organisation
    let orgId: string;
    if (p.orgGln) {
      orgId = await this.resolveOrgId(p.orgGln, p.orgName ?? "");
    } else {
      orgId = `org-${userId}`;
    }

    const roleId = `practitioner-role-${userId}`;

    // 3. Build bundle entries
    const entries: FhirEntry[] = [];

    const practitioner: Record<string, unknown> = {
      resourceType: "Practitioner",
      id: practId,
      identifier: this.buildIdentifiers(p.gln, p.localId, p.zsr),
      name: [{
        use: "official",
        ...(p.lastName  && { family: p.lastName }),
        ...(p.firstName && { given: [p.firstName] }),
      }],
      address: this.buildAddress(p),
      ...(p.email && { telecom: [{ system: "email", value: p.email }] }),
    };
    if ((practitioner.identifier as unknown[]).length === 0) delete practitioner.identifier;
    entries.push(this.entry(practitioner));

    // Ensure org resource exists
    if (p.orgGln) {
      const orgIdentifiers = this.buildIdentifiers(p.orgGln);
      entries.push(this.entry({
        resourceType: "Organization",
        id: orgId,
        ...(orgIdentifiers.length > 0 && { identifier: orgIdentifiers }),
        ...(p.orgName && { name: p.orgName }),
      }));
    }

    // Only reference Organization if one was resolved / included in the bundle.
    // Without orgGln the orgId is a placeholder that does not exist in FHIR —
    // referencing it would cause a 400 "resource not found" from HAPI.
    const practitionerRole: Record<string, unknown> = {
      resourceType: "PractitionerRole",
      id: roleId,
      active: true,
      practitioner: { reference: `Practitioner/${practId}` },
      ...(p.orgGln && { organization: { reference: `Organization/${orgId}` } }),
      // FHIR R4: PractitionerRole.location[] — required for NAT users
      ...(p.locationId && {
        location: [{ reference: `Location/${p.locationId}`, display: p.locationName }],
      }),
    };
    // Resolve role codes: prefer roleTypes[] (multi-role), fall back to single roleType.
    const roleCodes: string[] = p.roleTypes?.length
      ? p.roleTypes
      : p.roleType
        ? [p.roleType]
        : [];

    if (roleCodes.length > 0) {
      practitionerRole.code = roleCodes.map((code) => ({
        coding: [{ system: ROLE_SYSTEM, code }],
        text:   code,
      }));
    }
    entries.push(this.entry(practitionerRole));

    const ok = await this.postBundle(entries);
    if (!ok.success) return ok;

    this.log.info("NAT sync ok", { userId, practId, orgId, roleId });
    return { success: true, practitionerId: practId, practitionerRoleId: roleId, organizationId: orgId };
  }

  // ── JUR: Organization (with optional partOf) ────────────────────────────────

  private async syncJUR(userId: string, p: ManagedUserProfile): Promise<PractitionerSyncResult> {
    let orgId = await this.findByGln("Organization", p.gln);
    if (!orgId && p.organization) orgId = await this.findOrgByName(p.organization);
    orgId = orgId ?? `org-${userId}`;

    const entries: FhirEntry[] = [];

    const org: Record<string, unknown> = {
      resourceType: "Organization",
      id: orgId,
      identifier: this.buildIdentifiers(p.gln, p.localId, p.zsr, p.uid, p.bur),
      ...(p.organization && { name: p.organization }),
      address: this.buildAddress(p),
    };
    if ((org.identifier as unknown[]).length === 0) delete org.identifier;

    if (p.orgGln) {
      const parentId = await this.resolveOrgId(p.orgGln, p.orgName ?? "");
      org.partOf = { reference: `Organization/${parentId}` };
      entries.push(this.entry({
        resourceType: "Organization",
        id: parentId,
        ...(this.buildIdentifiers(p.orgGln).length > 0 && { identifier: this.buildIdentifiers(p.orgGln) }),
        ...(p.orgName && { name: p.orgName }),
      }));
    }
    entries.push(this.entry(org));

    // OrganizationAffiliation: Auftraggeber (JUR) ↔ Labor (ZLZ)
    // FHIR R4: organization = Labor (Auftragnehmer), participatingOrganization = Klinik (Auftraggeber)
    const affId = `aff-${LAB_ORG_ID}-${orgId}`;
    entries.push(this.entry({
      resourceType: "OrganizationAffiliation",
      id: affId,
      active: true,
      organization: { reference: `Organization/${LAB_ORG_ID}` },
      participatingOrganization: { reference: `Organization/${orgId}` },
      code: [{
        coding: [{ system: "http://hl7.org/fhir/organization-role", code: "laboratory", display: "Laboratory" }],
        text: "Labor-Dienstleister",
      }],
    }));

    const ok = await this.postBundle(entries);
    if (!ok.success) return ok;

    this.log.info("JUR sync ok", { userId, orgId });
    return { success: true, organizationId: orgId };
  }

  // ── PER: Person resource (regular staff — admin, IT, reception) ──────────────

  private async syncPER(userId: string, p: ManagedUserProfile): Promise<PractitionerSyncResult> {
    const personId = `person-${userId}`;

    const person: Record<string, unknown> = {
      resourceType: "Person",
      id: personId,
      active: true,
      name: [{
        use: "official",
        ...(p.lastName  && { family: p.lastName }),
        ...(p.firstName && { given: [p.firstName] }),
      }],
      ...(p.email && { telecom: [{ system: "email", value: p.email, use: "work" }] }),
      address: this.buildAddress(p),
      // FHIR R4: Person.managingOrganization — links person to their organisation
      ...(p.orgFhirId && { managingOrganization: { reference: `Organization/${p.orgFhirId}` } }),
    };

    // Optional GLN identifier
    const ids = this.buildIdentifiers(p.gln, p.localId);
    if (ids.length > 0) person.identifier = ids;

    const ok = await this.postBundle([this.entry(person)]);
    if (!ok.success) return ok;

    this.log.info("PER sync ok", { userId, personId, orgFhirId: p.orgFhirId });
    return { success: true, practitionerId: personId };
  }

  // ── FHIR helpers ─────────────────────────────────────────────────────────────

  private async fhirSearch(resourceType: string, params: string): Promise<string | null> {
    const url = `${this.fhirBase}/${resourceType}?${params}&_count=1`;
    try {
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

  private findByGln(rt: "Practitioner" | "Organization", gln?: string): Promise<string | null> {
    if (!gln) return Promise.resolve(null);
    return this.fhirSearch(rt, `identifier=${encodeURIComponent(`${GLN_SYSTEM}|${gln}`)}`);
  }

  private findOrgByName(name: string): Promise<string | null> {
    return this.fhirSearch("Organization", `name=${encodeURIComponent(name)}`);
  }

  private findPractitionerByName(family: string, given: string): Promise<string | null> {
    return this.fhirSearch(
      "Practitioner",
      `family=${encodeURIComponent(family)}&given=${encodeURIComponent(given)}`,
    );
  }

  private async resolveOrgId(orgGln: string, orgName: string): Promise<string> {
    let id = await this.findByGln("Organization", orgGln);
    if (!id && orgName) id = await this.findOrgByName(orgName);
    return id ?? `org-${orgGln}`;
  }

  private buildIdentifiers(gln?: string, localId?: string, zsr?: string, uid?: string, bur?: string) {
    const ids: { system: string; value: string }[] = [];
    if (gln)     ids.push({ system: GLN_SYSTEM,      value: gln });
    if (localId) ids.push({ system: LOCAL_ID_SYSTEM, value: localId });
    if (zsr)     ids.push({ system: ZSR_SYSTEM,      value: zsr });
    if (uid)     ids.push({ system: UID_SYSTEM,       value: uid });
    if (bur)     ids.push({ system: BUR_SYSTEM,       value: bur });
    return ids;
  }

  private buildAddress(p: ManagedUserProfile) {
    const line = [p.street, p.streetNo].filter(Boolean).join(" ");
    const addr: Record<string, unknown> = {};
    if (line)     addr.line = [line];
    if (p.zip)    addr.postalCode = p.zip;
    if (p.city)   addr.city = p.city;
    if (p.canton) addr.state = p.canton;
    if (p.country) addr.country = p.country;
    return [addr];
  }

  private entry(resource: Record<string, unknown>): FhirEntry {
    const id  = resource.id as string;
    const rt  = resource.resourceType as string;
    return {
      fullUrl: `${this.fhirBase}/${rt}/${id}`,
      resource,
      request: { method: "PUT", url: `${rt}/${id}` },
    };
  }

  private async postBundle(entries: FhirEntry[]): Promise<PractitionerSyncResult> {
    const bundle = { resourceType: "Bundle", type: "transaction", entry: entries };
    try {
      const res = await this.fetchFn(this.fhirBase, {
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
        this.log.error("FHIR bundle POST failed", { status: res.status, body: text.slice(0, 300) });
        return { success: false, error: `FHIR ${res.status}: ${text.slice(0, 200)}` };
      }
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }
}

/** Production singleton. */
export const practitionerMapper = new PractitionerMapper();
