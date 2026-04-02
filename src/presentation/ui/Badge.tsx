"use client";

// ── Variants ──────────────────────────────────────────────────────────────────

const VARIANT_CLASSES = {
  gray:    "bg-gray-100   text-gray-700  border-gray-300",
  blue:    "bg-blue-100   text-blue-700  border-blue-300",
  green:   "bg-green-100  text-green-700 border-green-300",
  yellow:  "bg-yellow-100 text-yellow-700 border-yellow-300",
  red:     "bg-red-100    text-red-700   border-red-300",
  purple:  "bg-purple-100 text-purple-700 border-purple-300",
  indigo:  "bg-indigo-100 text-indigo-700 border-indigo-300",
} as const;

// ── Props ─────────────────────────────────────────────────────────────────────

export interface BadgeProps {
  label: string;
  variant?: keyof typeof VARIANT_CLASSES;
  icon?: string;
  tooltip?: string;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Design-system Badge — used for status labels, tags, and counts.
 *
 * @example
 * <Badge label="Abgeschlossen" variant="green" icon="✅" tooltip="Befund freigegeben" />
 * <Badge label="Entwurf" variant="gray" icon="✏️" />
 */
export function Badge({ label, variant = "gray", icon, tooltip, className = "" }: BadgeProps) {
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
            "w-64 rounded border border-zt-border bg-zt-bg-card shadow-lg",
            "px-3 py-2 text-xs text-zt-text-primary",
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
