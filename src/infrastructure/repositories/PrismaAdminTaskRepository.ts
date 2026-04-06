import type { IAdminTaskRepository }      from "@/application/interfaces/repositories/IAdminTaskRepository";
import type { AdminTask, AdminTaskInput, AdminTaskType } from "@/domain/entities/AdminTask";
import { prisma }                          from "../db/prismaClient";
import { randomUUID }                      from "crypto";

function toAdminTask(row: {
  id: string; type: string; severity: string;
  orgId: string | null; serviceType: string | null;
  message: string; metadata: string; status: string;
  resolvedAt: Date | null; createdAt: Date; updatedAt: Date;
}): AdminTask {
  return {
    id:          row.id,
    type:        row.type        as AdminTask["type"],
    severity:    row.severity    as AdminTask["severity"],
    status:      row.status      as AdminTask["status"],
    message:     row.message,
    metadata:    JSON.parse(row.metadata) as Record<string, unknown>,
    ...(row.orgId       !== null && { orgId:       row.orgId }),
    ...(row.serviceType !== null && { serviceType: row.serviceType }),
    ...(row.resolvedAt  !== null && { resolvedAt:  row.resolvedAt.toISOString() }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class PrismaAdminTaskRepository implements IAdminTaskRepository {
  async create(input: AdminTaskInput): Promise<AdminTask> {
    const now = new Date();
    const row = await prisma.adminTask.create({
      data: {
        id:          randomUUID(),
        type:        input.type,
        severity:    input.severity,
        orgId:       input.orgId       ?? null,
        serviceType: input.serviceType ?? null,
        message:     input.message,
        metadata:    JSON.stringify(input.metadata ?? {}),
        status:      "OPEN",
        createdAt:   now,
        updatedAt:   now,
      },
    });
    return toAdminTask(row);
  }

  async findOpen(type?: AdminTaskType): Promise<AdminTask[]> {
    const rows = await prisma.adminTask.findMany({
      where: {
        status: "OPEN",
        ...(type !== undefined && { type }),
      },
      orderBy: [
        { severity: "desc" },
        { createdAt: "desc" },
      ],
    });
    return rows.map(toAdminTask);
  }

  async findOpenByTypeAndServiceType(
    type:        AdminTaskType,
    serviceType: string,
  ): Promise<AdminTask | null> {
    const row = await prisma.adminTask.findFirst({
      where:   { type, serviceType, status: "OPEN" },
      orderBy: { createdAt: "desc" },
    });
    return row ? toAdminTask(row) : null;
  }

  async resolve(id: string): Promise<AdminTask> {
    const now = new Date();
    const row = await prisma.adminTask.update({
      where: { id },
      data:  { status: "RESOLVED", resolvedAt: now, updatedAt: now },
    });
    return toAdminTask(row);
  }

  async countOpen(): Promise<number> {
    return prisma.adminTask.count({ where: { status: "OPEN" } });
  }
}

export const adminTaskRepository = new PrismaAdminTaskRepository();
