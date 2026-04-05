// Value object — pool alert thresholds. Immutable, self-validating.

export type AlertLevel = "info" | "warn" | "error";

export interface PoolThresholdData {
  /** Send INFO email when available numbers drop to or below this value. */
  infoAt:             number;
  /** Send WARN email when available numbers drop to or below this value. */
  warnAt:             number;
  /** Send ERROR email when available numbers drop to or below this value. */
  errorAt:            number;
  /** Email address(es) for notifications. Comma-separated for multiple. */
  notificationEmail:  string;
}

export class PoolThreshold {
  readonly infoAt:            number;
  readonly warnAt:            number;
  readonly errorAt:           number;
  readonly notificationEmail: string;

  constructor(data: PoolThresholdData) {
    if (data.errorAt >= data.warnAt) {
      throw new Error("errorAt must be less than warnAt");
    }
    if (data.warnAt >= data.infoAt) {
      throw new Error("warnAt must be less than infoAt");
    }
    if (data.errorAt < 0 || data.warnAt < 0 || data.infoAt < 0) {
      throw new Error("Threshold values must be non-negative");
    }
    this.infoAt            = data.infoAt;
    this.warnAt            = data.warnAt;
    this.errorAt           = data.errorAt;
    this.notificationEmail = data.notificationEmail.trim();
  }

  /** Returns the alert level for the given remaining count, or null if no alert. */
  levelFor(remaining: number): AlertLevel | null {
    if (remaining <= this.errorAt) return "error";
    if (remaining <= this.warnAt)  return "warn";
    if (remaining <= this.infoAt)  return "info";
    return null;
  }

  toData(): PoolThresholdData {
    return {
      infoAt:            this.infoAt,
      warnAt:            this.warnAt,
      errorAt:           this.errorAt,
      notificationEmail: this.notificationEmail,
    };
  }
}
