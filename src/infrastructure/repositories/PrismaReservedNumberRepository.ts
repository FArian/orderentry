import type { IReservedNumberRepository, PoolStats } from "@/application/interfaces/repositories/IReservedNumberRepository";
import type { ReservedOrderNumber, ReservedNumberInput } from "@/domain/entities/ReservedOrderNumber";
import type { ServiceType }                              from "@/domain/strategies/IOrderNumberStrategy";
import type { PoolThresholdData }                        from "@/domain/valueObjects/PoolThreshold";
import { prisma }                                        from "../db/prismaClient";
import { randomUUID }                                    from "crypto";
import { createLogger }                                  from "../logging/Logger";

const log = createLogger("PrismaReservedNumberRepository");

function toReserved(row: {
  id: string; number: string; serviceType: string; status: string;
  orgFhirId: string | null;
  usedAt: Date | null; usedForPatientId: string | null;
  usedForServiceRequestId: string | null; createdAt: Date;
}): ReservedOrderNumber {
  return {
    id:          row.id,
    number:      row.number,
    serviceType: row.serviceType as ServiceType,
    status:      row.status as "available" | "used",
    orgFhirId:   row.orgFhirId ?? null,
    ...(row.usedAt                  && { usedAt:                  row.usedAt.toISOString() }),
    ...(row.usedForPatientId        && { usedForPatientId:        row.usedForPatientId }),
    ...(row.usedForServiceRequestId && { usedForServiceRequestId: row.usedForServiceRequestId }),
    createdAt: row.createdAt.toISOString(),
  };
}

export class PrismaReservedNumberRepository implements IReservedNumberRepository {
  async findAll(): Promise<ReservedOrderNumber[]> {
    const rows = await prisma.reservedOrderNumber.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(toReserved);
  }

  /**
   * Find next available number.
   * Priority: org-specific (orgFhirId matches) → shared (orgFhirId IS NULL).
   * Pass null/undefined to search shared pool only.
   */
  async findNext(serviceType: ServiceType, orgFhirId?: string | null): Promise<ReservedOrderNumber | null> {
    if (orgFhirId) {
      // Try org-specific first
      const orgRow = await prisma.reservedOrderNumber.findFirst({
        where:   { status: "available", serviceType, orgFhirId },
        orderBy: { createdAt: "asc" },
      });
      if (orgRow) return toReserved(orgRow);
    }
    // Fall back to shared pool (orgFhirId IS NULL)
    const row = await prisma.reservedOrderNumber.findFirst({
      where:   { status: "available", serviceType, orgFhirId: null },
      orderBy: { createdAt: "asc" },
    });
    return row ? toReserved(row) : null;
  }

  async markUsed(id: string, patientId?: string, serviceRequestId?: string): Promise<ReservedOrderNumber> {
    const row = await prisma.reservedOrderNumber.update({
      where: { id },
      data:  {
        status:                  "used",
        usedAt:                  new Date(),
        ...(patientId        && { usedForPatientId:        patientId }),
        ...(serviceRequestId && { usedForServiceRequestId: serviceRequestId }),
      },
    });
    return toReserved(row);
  }

  async addMany(numbers: ReservedNumberInput[]): Promise<number> {
    // Insert individually and skip duplicates (createMany skipDuplicates is PostgreSQL-only).
    let count = 0;
    for (const n of numbers) {
      try {
        await prisma.reservedOrderNumber.create({
          data: {
            id:         randomUUID(),
            number:     n.number,
            serviceType: n.serviceType,
            orgFhirId:  n.orgFhirId ?? null,
          },
        });
        count++;
      } catch {
        // Unique constraint violation — duplicate number, skip.
        log.debug("addNumbers: skipped duplicate number", { number: n.number });
      }
    }
    return count;
  }

  async delete(id: string): Promise<void> {
    await prisma.reservedOrderNumber.delete({ where: { id } });
  }

  async stats(): Promise<PoolStats> {
    const [total, available] = await Promise.all([
      prisma.reservedOrderNumber.count(),
      prisma.reservedOrderNumber.count({ where: { status: "available" } }),
    ]);
    return { total, available, used: total - available };
  }

  async countAvailable(serviceType?: string): Promise<number> {
    return prisma.reservedOrderNumber.count({
      where: {
        status: "available",
        ...(serviceType !== undefined && { serviceType }),
      },
    });
  }

  async getThresholds(): Promise<PoolThresholdData> {
    const row = await prisma.poolThresholdConfig.upsert({
      where:  { id: "default" },
      update: {},
      create: { id: "default" },
    });
    return {
      infoAt:            row.infoAt,
      warnAt:            row.warnAt,
      errorAt:           row.errorAt,
      notificationEmail: row.notificationEmail,
    };
  }

  async setThresholds(data: PoolThresholdData): Promise<void> {
    await prisma.poolThresholdConfig.upsert({
      where:  { id: "default" },
      update: data,
      create: { id: "default", ...data },
    });
  }
}

export const reservedNumberRepository = new PrismaReservedNumberRepository();
