import type { OrgRule, OrgRuleInput } from "@/domain/entities/OrgRule";

export interface IOrgRuleRepository {
  findAll(): Promise<OrgRule[]>;
  findByFhirId(orgFhirId: string): Promise<OrgRule | null>;
  findByGln(orgGln: string): Promise<OrgRule | null>;
  create(input: OrgRuleInput): Promise<OrgRule>;
  update(id: string, patch: Partial<OrgRuleInput>): Promise<OrgRule>;
  delete(id: string): Promise<void>;
}
