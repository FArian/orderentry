import { createLogger }              from "@/infrastructure/logging/Logger";
import { orgRuleRepository }         from "@/infrastructure/repositories/PrismaOrgRuleRepository";
import type { CreateOrgRuleDto, UpdateOrgRuleDto } from "@/infrastructure/api/dto/OrgRuleDto";

const log = createLogger("OrgRulesController");

export class OrgRulesController {
  async list() {
    const data = await orgRuleRepository.findAll();
    return { data, total: data.length };
  }

  async getById(id: string) {
    const rules = await orgRuleRepository.findAll();
    const rule  = rules.find((r) => r.id === id);
    if (!rule) return { httpStatus: 404, error: "OrgRule not found" };
    return rule;
  }

  async create(body: CreateOrgRuleDto) {
    if (!body.orgFhirId || !body.orgName) {
      return { httpStatus: 400, error: "orgFhirId and orgName are required" };
    }
    try {
      const rule = await orgRuleRepository.create(body);
      log.info("OrgRule created", { id: rule.id, orgFhirId: rule.orgFhirId });
      return { ...rule, httpStatus: 201 };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Unique constraint")) {
        return { httpStatus: 409, error: "OrgRule for this organization already exists" };
      }
      log.error("OrgRule create failed", { message });
      return { httpStatus: 500, error: message };
    }
  }

  async update(id: string, body: UpdateOrgRuleDto) {
    try {
      const rule = await orgRuleRepository.update(id, body);
      log.info("OrgRule updated", { id });
      return rule;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Record to update not found")) {
        return { httpStatus: 404, error: "OrgRule not found" };
      }
      return { httpStatus: 500, error: message };
    }
  }

  async delete(id: string) {
    try {
      await orgRuleRepository.delete(id);
      log.info("OrgRule deleted", { id });
      return { deleted: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Record to delete does not exist")) {
        return { httpStatus: 404, error: "OrgRule not found" };
      }
      return { httpStatus: 500, error: message };
    }
  }
}

export const orgRulesController = new OrgRulesController();
