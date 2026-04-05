import { randomBytes, createHash } from "crypto";
import { agentRegistrationRepository } from "@/infrastructure/repositories/PrismaAgentRegistrationRepository";
import type {
  RegisterAgentRequestDto,
  RegisterAgentResponseDto,
  AgentRegistrationResponseDto,
  ListAgentsResponseDto,
} from "@/infrastructure/api/dto/AgentRegistrationDto";
import type { AgentRegistrationData } from "@/application/interfaces/repositories/IAgentRegistrationRepository";

function generateApiKey(): { plaintext: string; prefix: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  const plaintext = `zetlab_${raw}`;
  const prefix = plaintext.slice(0, 15);
  const hash = createHash("sha256").update(plaintext).digest("hex");
  return { plaintext, prefix, hash };
}

function toResponseDto(r: AgentRegistrationData): AgentRegistrationResponseDto {
  return {
    id:           r.id,
    name:         r.name,
    orgFhirId:    r.orgFhirId,
    orgGln:       r.orgGln,
    locationId:   r.locationId,
    apiKeyPrefix: r.apiKeyPrefix,
    status:       r.status,
    lastSeenAt:   r.lastSeenAt?.toISOString() ?? null,
    agentVersion: r.agentVersion,
    createdAt:    r.createdAt.toISOString(),
    updatedAt:    r.updatedAt.toISOString(),
  };
}

export class AgentRegistrationController {
  async register(body: RegisterAgentRequestDto): Promise<RegisterAgentResponseDto> {
    if (!body.name?.trim())      throw Object.assign(new Error("name ist erforderlich."), { status: 400 });
    if (!body.orgFhirId?.trim()) throw Object.assign(new Error("orgFhirId ist erforderlich."), { status: 400 });

    const { plaintext, prefix, hash } = generateApiKey();

    const created = await agentRegistrationRepository.create({
      name:      body.name.trim(),
      orgFhirId: body.orgFhirId.trim(),
      ...(body.orgGln     !== undefined && { orgGln:     body.orgGln }),
      ...(body.locationId !== undefined && { locationId: body.locationId }),
      apiKeyHash:   hash,
      apiKeyPrefix: prefix,
    });

    return {
      id:           created.id,
      name:         created.name,
      orgFhirId:    created.orgFhirId,
      orgGln:       created.orgGln,
      locationId:   created.locationId,
      apiKey:       plaintext,
      apiKeyPrefix: created.apiKeyPrefix,
      status:       created.status,
      createdAt:    created.createdAt.toISOString(),
    };
  }

  async list(): Promise<ListAgentsResponseDto> {
    const all = await agentRegistrationRepository.findAll();
    return {
      agents: all.map(toResponseDto),
      total:  all.length,
    };
  }

  async revoke(id: string): Promise<{ ok: boolean }> {
    const agent = await agentRegistrationRepository.findById(id);
    if (!agent) throw Object.assign(new Error("Agent nicht gefunden."), { status: 404 });
    await agentRegistrationRepository.revoke(id);
    return { ok: true };
  }

  async remove(id: string): Promise<{ ok: boolean }> {
    const agent = await agentRegistrationRepository.findById(id);
    if (!agent) throw Object.assign(new Error("Agent nicht gefunden."), { status: 404 });
    await agentRegistrationRepository.delete(id);
    return { ok: true };
  }
}

export const agentRegistrationController = new AgentRegistrationController();
