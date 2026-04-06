/**
 * PoolNotificationService — pool threshold alerts with full observability.
 *
 * Per alert:
 *   1. Evaluate remaining count vs thresholds for the given serviceType
 *   2. Anti-spam: skip if same or higher level already sent for this serviceType
 *   3. Create AdminTask (always — visible in admin UI even without email)
 *   4. Send email (if configured)
 *   5. Log to PoolNotificationLog (anti-spam state)
 *
 * Anti-spam reset: call recordRefill(serviceType) when pool is refilled.
 */

import type { IPoolNotificationService }  from "@/application/interfaces/services/IPoolNotificationService";
import type { IAdminTaskRepository }      from "@/application/interfaces/repositories/IAdminTaskRepository";
import type { IReservedNumberRepository } from "@/application/interfaces/repositories/IReservedNumberRepository";
import { PoolThreshold, type AlertLevel } from "@/domain/valueObjects/PoolThreshold";
import { createLogger }                   from "../logging/Logger";
import { prisma }                         from "../db/prismaClient";
import { randomUUID }                     from "crypto";

const log = createLogger("PoolNotificationService");

const LEVEL_ORDER: Record<AlertLevel, number> = { info: 1, warn: 2, error: 3 };

/** Map PoolThreshold AlertLevel → AdminTask severity */
const LEVEL_TO_SEVERITY: Record<AlertLevel, "INFO" | "WARNING" | "CRITICAL"> = {
  info:  "INFO",
  warn:  "WARNING",
  error: "CRITICAL",
};

export class PoolNotificationService implements IPoolNotificationService {
  constructor(
    private readonly pool:      IReservedNumberRepository,
    private readonly taskRepo:  IAdminTaskRepository,
    private readonly sendMail:  (to: string, subject: string, text: string) => Promise<void>,
  ) {}

  async checkAndNotify(remaining: number, serviceType: string, orgId?: string): Promise<void> {
    const thresholdData = await this.pool.getThresholds();

    let threshold: PoolThreshold;
    try {
      threshold = new PoolThreshold(thresholdData);
    } catch {
      log.warn("Invalid PoolThreshold config — skipping notification");
      return;
    }

    const level = threshold.levelFor(remaining);
    if (!level) return;

    // Anti-spam: skip if same or higher level already sent for this serviceType
    const lastLevel = await this.getLastSentLevel(serviceType);
    if (lastLevel && LEVEL_ORDER[lastLevel] >= LEVEL_ORDER[level]) return;

    // 1. Resolve or create AdminTask
    const existingTask = await this.taskRepo.findOpenByTypeAndServiceType(
      "ORDER_NUMBER_POOL_ALERT",
      serviceType,
    );
    const task = existingTask ?? await this.taskRepo.create({
      type:        "ORDER_NUMBER_POOL_ALERT",
      severity:    LEVEL_TO_SEVERITY[level],
      serviceType,
      ...(orgId !== undefined && { orgId }),
      message:     buildMessage(level, serviceType, remaining),
      metadata:    { remaining, level, threshold: thresholdData },
    });

    // 2. Log (anti-spam state tracking)
    await prisma.poolNotificationLog.create({
      data: {
        id:             randomUUID(),
        level,
        serviceType,
        remainingCount: remaining,
        taskId:         task.id,
      },
    });

    // 3. Send email
    if (thresholdData.notificationEmail) {
      await this.sendNotification(thresholdData.notificationEmail, level, serviceType, remaining);
    }
  }

  async recordRefill(serviceType?: string): Promise<void> {
    await prisma.poolNotificationLog.updateMany({
      where: {
        poolRefilled: false,
        ...(serviceType !== undefined && { serviceType }),
      },
      data: { poolRefilled: true },
    });
  }

  async getLastSentLevel(serviceType?: string): Promise<AlertLevel | null> {
    const last = await prisma.poolNotificationLog.findFirst({
      where: {
        poolRefilled: false,
        ...(serviceType !== undefined && { serviceType }),
      },
      orderBy: { sentAt: "desc" },
    });
    return last ? (last.level as AlertLevel) : null;
  }

  private async sendNotification(
    email:       string,
    level:       AlertLevel,
    serviceType: string,
    remaining:   number,
  ): Promise<void> {
    const emoji   = level === "error" ? "🔴" : level === "warn" ? "⚠️" : "ℹ️";
    const subject = `${emoji} OrderEntry Pool [${serviceType}]: ${remaining} Nummern verfügbar`;
    const text    = [
      `ServiceType: ${serviceType}`,
      `Warnstufe:   ${level.toUpperCase()}`,
      `Verbleibend: ${remaining} Nummern`,
      "",
      level === "error"
        ? "KRITISCH: Pool ist fast leer — Bestellungen werden bald blockiert!"
        : level === "warn"
          ? "WARNUNG: Bitte Nummernpool auffüllen."
          : "INFO: Nummernpool wird kleiner — bald auffüllen.",
      "",
      "Pool verwalten: Admin → Auftragsnummern",
    ].join("\n");

    try {
      await this.sendMail(email, subject, text);
      log.info("Pool notification sent", { level, serviceType, remaining, email });
    } catch (err) {
      log.error("Pool notification failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

function buildMessage(level: AlertLevel, serviceType: string, remaining: number): string {
  const prefix = level === "error"
    ? "KRITISCH"
    : level === "warn"
      ? "WARNUNG"
      : "INFO";
  return `${prefix}: Pool [${serviceType}] hat nur noch ${remaining} Nummern verfügbar.`;
}
