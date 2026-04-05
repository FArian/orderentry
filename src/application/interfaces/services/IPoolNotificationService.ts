import type { AlertLevel } from "@/domain/valueObjects/PoolThreshold";

/**
 * Checks remaining pool count against thresholds and sends email if needed.
 * Anti-spam: only one email per threshold crossing (until pool is refilled).
 */
export interface IPoolNotificationService {
  checkAndNotify(remaining: number): Promise<void>;
  recordRefill(): Promise<void>;
  getLastSentLevel(): Promise<AlertLevel | null>;
}
