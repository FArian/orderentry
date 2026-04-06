import type { IOrgRuleRepository }        from "@/application/interfaces/repositories/IOrgRuleRepository";
import type { OrgRule, OrgRuleInput }     from "@/domain/entities/OrgRule";
import type { ServiceType }              from "@/domain/strategies/IOrderNumberStrategy";
import { isServiceType }                 from "@/domain/strategies/IOrderNumberStrategy";
import { prisma }                         from "../db/prismaClient";
import type { OrgRule as PrismaOrgRule }  from "@prisma/client";
import { randomUUID }                     from "crypto";
import { createLogger }                   from "../logging/Logger";

const log = createLogger("PrismaOrgRuleRepository");

function parseMapping(raw: string): Record<string, ServiceType> {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: Record<string, ServiceType> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string" && isServiceType(v)) result[k] = v;
    }
    return result;
  } catch (err: unknown) {
    log.warn("parseMapping: invalid JSON in mapping field", { message: err instanceof Error ? err.message : String(err) });
    return {};
  }
}

function toOrgRule(row: PrismaOrgRule): OrgRule {
  return {
    id:                 row.id,
    orgFhirId:          row.orgFhirId,
    orgGln:             row.orgGln ?? "",
    orgName:            row.orgName,
    patientPrefix:      row.patientPrefix,
    casePrefix:         row.casePrefix,
    hl7Msh3:            row.hl7Msh3,
    hl7Msh4:            row.hl7Msh4,
    hl7Msh5:            row.hl7Msh5,
    hl7Msh6:            row.hl7Msh6,
    mibiPrefix:         row.mibiPrefix,
    mibiStart:          row.mibiStart,
    mibiLength:         row.mibiLength,
    pocPrefix:          row.pocPrefix,
    pocLength:          row.pocLength,
    routineLength:      row.routineLength,
    serviceTypeMapping: parseMapping(row.serviceTypeMapping),
    createdAt:          row.createdAt.toISOString(),
    updatedAt:          row.updatedAt.toISOString(),
  };
}

function toDbInput(input: Partial<OrgRuleInput>): Record<string, unknown> {
  const data: Record<string, unknown> = { ...input };
  if (input.serviceTypeMapping !== undefined) {
    data["serviceTypeMapping"] = JSON.stringify(input.serviceTypeMapping);
  }
  return data;
}

export class PrismaOrgRuleRepository implements IOrgRuleRepository {
  async findAll(): Promise<OrgRule[]> {
    const rows = await prisma.orgRule.findMany({ orderBy: { orgName: "asc" } });
    return rows.map(toOrgRule);
  }

  async findByFhirId(orgFhirId: string): Promise<OrgRule | null> {
    const row = await prisma.orgRule.findUnique({ where: { orgFhirId } });
    return row ? toOrgRule(row) : null;
  }

  async findByGln(orgGln: string): Promise<OrgRule | null> {
    if (!orgGln) return null;
    const row = await prisma.orgRule.findFirst({ where: { orgGln } });
    return row ? toOrgRule(row) : null;
  }

  async create(input: OrgRuleInput): Promise<OrgRule> {
    const row = await prisma.orgRule.create({
      data: {
        id: randomUUID(),
        orgFhirId:          input.orgFhirId,
        orgGln:             input.orgGln || null,   // store null when empty
        orgName:            input.orgName,
        patientPrefix:      input.patientPrefix,
        casePrefix:         input.casePrefix,
        hl7Msh3:            input.hl7Msh3,
        hl7Msh4:            input.hl7Msh4,
        hl7Msh5:            input.hl7Msh5,
        hl7Msh6:            input.hl7Msh6,
        mibiPrefix:         input.mibiPrefix,
        mibiStart:          input.mibiStart,
        mibiLength:         input.mibiLength ?? null,
        pocPrefix:          input.pocPrefix,
        pocLength:          input.pocLength ?? null,
        routineLength:      input.routineLength ?? null,
        serviceTypeMapping: JSON.stringify(input.serviceTypeMapping ?? {}),
      },
    });
    return toOrgRule(row);
  }

  async update(id: string, patch: Partial<OrgRuleInput>): Promise<OrgRule> {
    const row = await prisma.orgRule.update({
      where: { id },
      data:  toDbInput(patch),
    });
    return toOrgRule(row);
  }

  async delete(id: string): Promise<void> {
    await prisma.orgRule.delete({ where: { id } });
  }
}

export const orgRuleRepository = new PrismaOrgRuleRepository();
