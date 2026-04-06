import type {
  IAgentRegistrationRepository,
  AgentRegistrationData,
  CreateAgentRegistrationInput,
} from "@/application/interfaces/repositories/IAgentRegistrationRepository";
import { prisma } from "../db/prismaClient";

export class PrismaAgentRegistrationRepository implements IAgentRegistrationRepository {
  async create(input: CreateAgentRegistrationInput): Promise<AgentRegistrationData> {
    return prisma.agentRegistration.create({
      data: {
        name:         input.name,
        orgFhirId:    input.orgFhirId,
        ...(input.orgGln      !== undefined && { orgGln:     input.orgGln }),
        ...(input.locationId  !== undefined && { locationId: input.locationId }),
        apiKeyHash:   input.apiKeyHash,
        apiKeyPrefix: input.apiKeyPrefix,
      },
    });
  }

  async findAll(): Promise<AgentRegistrationData[]> {
    return prisma.agentRegistration.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string): Promise<AgentRegistrationData | null> {
    return prisma.agentRegistration.findUnique({ where: { id } });
  }

  async findByApiKeyPrefix(prefix: string): Promise<AgentRegistrationData[]> {
    return prisma.agentRegistration.findMany({
      where: { apiKeyPrefix: prefix, status: "active" },
    });
  }

  async updateLastSeen(id: string, agentVersion?: string): Promise<void> {
    await prisma.agentRegistration.update({
      where: { id },
      data: {
        lastSeenAt: new Date(),
        ...(agentVersion !== undefined && { agentVersion }),
      },
    });
  }

  async revoke(id: string): Promise<void> {
    await prisma.agentRegistration.update({
      where: { id },
      data: { status: "revoked" },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.agentRegistration.delete({ where: { id } });
  }
}

export const agentRegistrationRepository = new PrismaAgentRegistrationRepository();
