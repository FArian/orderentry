/**
 * PrismaAgentJobRepository — IAgentJobRepository backed by Prisma.
 *
 * Works with SQLite (default), PostgreSQL, and MSSQL.
 * payload is stored as a JSON string (same approach as User.profile).
 */

import type { IAgentJobRepository, CreateAgentJobInput } from "@/application/interfaces/repositories/IAgentJobRepository";
import type { AgentJob, AgentJobPayload } from "@/domain/entities/AgentJob";
import { prisma } from "../db/prismaClient";
import crypto from "node:crypto";
import type { AgentJob as PrismaAgentJob } from "@prisma/client";

function toAgentJob(row: PrismaAgentJob): AgentJob {
  return {
    id:         row.id,
    type:       row.type as AgentJob["type"],
    status:     row.status as AgentJob["status"],
    orgId:      row.orgId,
    locationId: row.locationId ?? null,
    payload:    JSON.parse(row.payload) as AgentJobPayload,
    createdAt:  row.createdAt.toISOString(),
    updatedAt:  row.updatedAt.toISOString(),
    doneAt:     row.doneAt ? row.doneAt.toISOString() : null,
  };
}

export class PrismaAgentJobRepository implements IAgentJobRepository {
  async create(input: CreateAgentJobInput): Promise<AgentJob> {
    const payload: AgentJobPayload = {
      documentReferenceId: input.documentReferenceId,
      serviceRequestId:    input.serviceRequestId,
      patientId:           input.patientId,
      orderNumber:         input.orderNumber,
      zpl:                 input.zpl,
    };

    const row = await prisma.agentJob.create({
      data: {
        id:         crypto.randomUUID(),
        type:       input.type,
        status:     "pending",
        orgId:      input.orgId,
        locationId: input.locationId ?? null,
        payload:    JSON.stringify(payload),
      },
    });

    return toAgentJob(row);
  }

  async listPending(orgId: string, locationId?: string): Promise<AgentJob[]> {
    const rows = await prisma.agentJob.findMany({
      where: {
        status: "pending",
        orgId,
        ...(locationId
          ? { OR: [{ locationId }, { locationId: null }] }
          : { locationId: null }
        ),
      },
      orderBy: { createdAt: "asc" },
    });

    return rows.map(toAgentJob);
  }

  async markDone(id: string): Promise<void> {
    await prisma.agentJob.update({
      where: { id },
      data:  { status: "done", doneAt: new Date() },
    });
  }

  async markFailed(id: string): Promise<void> {
    await prisma.agentJob.update({
      where: { id },
      data:  { status: "failed" },
    });
  }
}

export const agentJobRepository = new PrismaAgentJobRepository();
