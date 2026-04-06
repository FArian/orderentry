/**
 * AdminTasksController — detects incomplete FHIR registry entries.
 *
 * A "task" is any record that requires admin attention:
 *   - Organization without a GLN
 *   - Practitioner without a GLN (clinical roles only)
 *
 * Administrative roles (e.g. Administrative officer) are exempt from the GLN requirement
 * because they have no medical responsibility and do not appear in lab orders.
 *
 * GET /api/admin/tasks → AdminTasksResponseDto
 */

import { fhirOrganizationsController, type FhirOrganization } from "./FhirOrganizationsController";
import { fhirPractitionersController, type FhirPractitioner, type FhirPractitionerRole } from "./FhirPractitionersController";
import type { FhirOrganizationDto, FhirPractitionerDto } from "../dto/FhirRegistryDto";
import type { FhirBundle } from "@/infrastructure/fhir/FhirTypes";
import { EnvConfig } from "@/infrastructure/config/EnvConfig";

const GLN_SYSTEMS = [EnvConfig.fhirSystems.gln, "urn:oid:2.51.1.3"];

// Role codes that are exempt from the GLN requirement.
// Administrative/non-clinical roles have no medical responsibility
// and do not appear as ordering practitioners in lab workflows.
const GLN_EXEMPT_ROLE_CODES = new Set([
  // SNOMED CT — administrative roles
  "224608005", // Administrative officer
  "224599007", // Receptionist
  "159561009", // Office clerk
  "394738000", // Other categories
  // Swiss OID urn:oid:2.51.1.3.roleType — none currently exempt
]);

export interface AdminTasksResponseDto {
  total:                   number;
  orgsWithoutGln:          FhirOrganizationDto[];
  practitionersWithoutGln: FhirPractitionerDto[];
  httpStatus?:             number;
}

type BundleResource = FhirPractitioner | FhirPractitionerRole | { resourceType: string; id?: string };

export class AdminTasksController {
  async list(): Promise<AdminTasksResponseDto> {
    const [orgsResult, practsResult] = await Promise.all([
      fhirOrganizationsController.list(),
      fhirPractitionersController.list(),
    ]);

    // Parse FHIR Bundle<Organization>
    const orgBundle = orgsResult as FhirBundle<FhirOrganization>;
    const allOrgs: FhirOrganizationDto[] = (orgBundle.entry ?? [])
      .map((e) => e.resource)
      .filter((r): r is FhirOrganization => !!r && !!r.id)
      .map((org) => ({
        id:   org.id!,
        name: org.name ?? "",
        gln:  org.identifier?.find((i) => i.system !== undefined && GLN_SYSTEMS.includes(i.system))?.value ?? "",
      }));

    // Parse FHIR Bundle with PractitionerRole + included resources
    const practBundle = practsResult as FhirBundle<BundleResource>;
    const practsById  = new Map<string, FhirPractitioner>();
    const roles: FhirPractitionerRole[] = [];
    for (const entry of practBundle.entry ?? []) {
      const r = entry.resource as Record<string, unknown> | undefined;
      if (!r) continue;
      if (r.resourceType === "Practitioner") {
        const p = r as FhirPractitioner;
        if (p.id) practsById.set(p.id, p);
      } else if (r.resourceType === "PractitionerRole") {
        roles.push(r as FhirPractitionerRole);
      }
    }
    const allPracts: FhirPractitionerDto[] = roles
      .filter((role) => !!role.id)
      .map((role) => {
        const practRef = role.practitioner?.reference ?? "";
        const practId  = practRef.split("/").at(-1) ?? "";
        const pract    = practsById.get(practId);
        const name     = pract?.name?.[0];
        const roleCode = role.code?.[0]?.coding?.[0]?.code ?? "";
        return {
          id:                 pract?.id ?? practId,
          firstName:          name?.given?.[0] ?? "",
          lastName:           name?.family ?? "",
          gln:                pract?.identifier?.find((i) => i.system !== undefined && GLN_SYSTEMS.includes(i.system))?.value ?? "",
          organizationId:     "",
          organizationName:   "",
          roleCode,
          roleDisplay:        role.code?.[0]?.coding?.[0]?.display ?? role.code?.[0]?.text ?? "",
          practitionerRoleId: role.id!,
        };
      });

    const orgsWithoutGln          = allOrgs.filter((o) => !o.gln?.trim());
    const practitionersWithoutGln = allPracts.filter(
      (p) => !p.gln?.trim() && !GLN_EXEMPT_ROLE_CODES.has(p.roleCode),
    );
    const total                   = orgsWithoutGln.length + practitionersWithoutGln.length;
    return { total, orgsWithoutGln, practitionersWithoutGln };
  }
}

export const adminTasksController = new AdminTasksController();
