/**
 * PoolNotificationService — checks pool thresholds and sends email alerts.
 *
 * Anti-spam rule: one email per threshold level until pool is refilled.
 * Uses PoolNotificationLog table to track which levels have been notified.
 */

import type { IPoolNotificationService }  from "@/application/interfaces/services/IPoolNotificationService";
import type { IReservedNumberRepository } from "@/application/interfaces/repositories/IReservedNumberRepository";
import { PoolThreshold, type AlertLevel } from "@/domain/valueObjects/PoolThreshold";
import { createLogger }                   from "@/infrastructure/logging/Logger";
import { prisma }                         from "@/infrastructure/db/prismaClient";
import { randomUUID }                     from "crypto";

const log = createLogger("PoolNotificationService");

const LEVEL_ORDER: Record<AlertLevel, number> = { info: 1, warn: 2, error: 3 };

export class PoolNotificationService implements IPoolNotificationService {
  constructor(
    private readonly pool:    IReservedNumberRepository,
    private readonly sendMail: (to: string, subject: string, text: string) => Promise<void>,
  ) {}

  async checkAndNotify(remaining: number): Promise<void> {
    const thresholdData = await this.pool.getThresholds();
    if (!thresholdData.notificationEmail) return;

    let threshold: PoolThreshold;
    try {
      threshold = new PoolThreshold(thresholdData);
    } catch {
      log.warn("Invalid PoolThreshold config — skipping notification");
      return;
    }

    const level = threshold.levelFor(remaining);
    if (!level) return;

    const lastLevel = await this.getLastSentLevel();
    if (lastLevel && LEVEL_ORDER[lastLevel] >= LEVEL_ORDER[level]) return;

    await this.sendNotification(thresholdData.notificationEmail, level, remaining);

    await prisma.poolNotificationLog.create({
      data: {
        id:             randomUUID(),
        level,
        remainingCount: remaining,
      },
    });
  }

  async recordRefill(): Promise<void> {
    await prisma.poolNotificationLog.updateMany({
      where: { poolRefilled: false },
      data:  { poolRefilled: true },
    });
  }

  async getLastSentLevel(): Promise<AlertLevel | null> {
    const last = await prisma.poolNotificationLog.findFirst({
      where:   { poolRefilled: false },
      orderBy: { sentAt: "desc" },
    });
    return last ? (last.level as AlertLevel) : null;
  }

  private async sendNotification(email: string, level: AlertLevel, remaining: number): Promise<void> {
    const emoji   = level === "error" ? "🔴" : level === "warn" ? "⚠️" : "ℹ️";
    const subject = `${emoji} OrderEntry Nummernpool: ${remaining} Nummern verfügbar`;
    const text    = [
      `Warnstufe: ${level.toUpperCase()}`,
      `Verbleibende Nummern im Pool: ${remaining}`,
      "",
      level === "error"
        ? "KRITISCH: Der Pool ist fast leer. Bestellungen werden bald blockiert!"
        : level === "warn"
          ? "WARNUNG: Bitte füllen Sie den Nummernpool auf."
          : "INFO: Der Nummernpool wird kleiner. Bitte bald auffüllen.",
      "",
      "Pool verwalten: Admin → Nummernpool",
    ].join("\n");

    try {
      await this.sendMail(email, subject, text);
      log.info("Pool notification sent", { level, remaining, email });
    } catch (err) {
      log.error("Pool notification failed", { error: err instanceof Error ? err.message : String(err) });
    }
  }
}
