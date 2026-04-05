import type { OrgRule, OrgRuleInput } from "@/domain/entities/OrgRule";

export type OrgRuleDto         = OrgRule;
export type OrgRuleResponseDto = OrgRule;

export type CreateOrgRuleDto  = OrgRuleInput;
export type UpdateOrgRuleDto  = Partial<OrgRuleInput>;

export interface ListOrgRulesResponseDto {
  data:  OrgRuleResponseDto[];
  total: number;
}
