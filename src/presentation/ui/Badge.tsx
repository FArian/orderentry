"use client";

// ── Variants ──────────────────────────────────────────────────────────────────
// Semantic names — never use generic colors like "blue" or "red".
// Each variant maps to a specific zt-* design token group.

const VARIANT_CLASSES = {
  /** Default state — registered, unknown, not-yet-processed */
  neutral:  "bg-zt-bg-muted      text-zt-text-secondary  border-zt-border",
  /** Active order, active process, informational */
  info:     "bg-zt-info-light    text-zt-info            border-zt-info-border",
  /** Final result, completed order, confirmed */
  success:  "bg-zt-success-light text-zt-success         border-zt-success-border",
  /** Pending, on-hold, partially ready */
  warning:  "bg-zt-warning-bg    text-zt-warning-text    border-zt-warning-border",
  /** Cancelled, revoked, invalid, entered-in-error */
  danger:   "bg-zt-danger-light  text-zt-danger          border-zt-danger-border",
  /** Critical lab values — life-threatening, requires immediate action */
  critical: "bg-zt-critical-light text-zt-critical       border-zt-critical-border",
  /** Urgent / STAT orders — time-critical */
  urgent:   "bg-zt-urgent-light  text-zt-urgent          border-zt-urgent-border",
  /** Amended or corrected lab report */
  amended:  "bg-zt-amended-light text-zt-amended         border-zt-amended-border",
} as const;

export type BadgeVariant = keyof typeof VARIANT_CLASSES;

// ── Props ─────────────────────────────────────────────────────────────────────

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  icon?: string;
  tooltip?: string;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Design-system Badge — status labels, tags, and counts.
 *
 * Use semantic variants, never raw colors:
 * @example
 * <Badge label="Abgeschlossen" variant="success" icon="✅" tooltip="Befund freigegeben" />
 * <Badge label="Vorläufig"     variant="info"    icon="🔬" />
 * <Badge label="Kritisch"      variant="critical" icon="⚠️" />
 * <Badge label="STAT"          variant="urgent"  icon="🚨" />
 */
export function Badge({ label, variant = "neutral", icon, tooltip, className = "" }: BadgeProps) {
  return (
    <div className={`relative group inline-block ${className}`}>
      <span
        className={[
          "inline-flex items-center gap-1.5 rounded border",
          "px-2 py-0.5 text-xs font-medium",
          "cursor-default select-none",
          VARIANT_CLASSES[variant],
        ].join(" ")}
      >
        {icon && <span aria-hidden="true">{icon}</span>}
        <span>{label}</span>
      </span>

      {tooltip && (
        <div
          role="tooltip"
          className={[
            "pointer-events-none absolute left-0 top-full mt-1 z-50",
            "w-64 rounded-lg border border-zt-border bg-zt-bg-card",
            "shadow-lg px-3 py-2 text-xs text-zt-text-primary",
            "opacity-0 group-hover:opacity-100 transition-opacity duration-150",
          ].join(" ")}
        >
          {icon && (
            <div className="font-semibold mb-1">
              {icon} {label}
            </div>
          )}
          <p className="leading-relaxed text-zt-text-secondary">{tooltip}</p>
        </div>
      )}
    </div>
  );
}
