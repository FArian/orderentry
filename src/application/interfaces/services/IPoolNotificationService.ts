import type { AlertLevel } from "@/domain/valueObjects/PoolThreshold";

/**
 * Checks remaining pool count against thresholds and sends email + creates AdminTask.
 * Anti-spam: only one alert per (serviceType + level) until pool is refilled.
 */
export interface IPoolNotificationService {
  /**
   * Evaluate remaining count against thresholds.
   * Creates an AdminTask and sends email when a new threshold is crossed.
   * @param remaining  - available pool entries for this serviceType
   * @param serviceType - the service type being evaluated (MIBI, ROUTINE, POC, …)
   * @param orgId       - optional org FHIR ID for org-specific pools
   */
  checkAndNotify(remaining: number, serviceType: string, orgId?: string): Promise<void>;

  /**
   * Mark all active notification logs as refilled.
   * Resets anti-spam state so the next threshold crossing sends a new alert.
   * @param serviceType - if provided, resets only for this type; otherwise resets all
   */
  recordRefill(serviceType?: string): Promise<void>;

  /**
   * Return the highest alert level already sent for this serviceType (and not yet refilled).
   * Returns null if no alert has been sent or pool was refilled.
   */
  getLastSentLevel(serviceType?: string): Promise<AlertLevel | null>;
}
