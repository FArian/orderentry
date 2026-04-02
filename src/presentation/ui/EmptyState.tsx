"use client";

import type { ReactNode } from "react";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Design-system EmptyState — shown when a list or search returns no results.
 *
 * @example
 * <EmptyState
 *   icon="🔬"
 *   title="Keine Befunde gefunden"
 *   description="Passen Sie Ihre Suchkriterien an."
 *   action={<Button onClick={reset}>Suche zurücksetzen</Button>}
 * />
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={[
        "flex flex-col items-center justify-center",
        "gap-3 py-16 text-center",
        className,
      ].join(" ")}
      role="status"
    >
      {icon && (
        <span className="text-4xl" aria-hidden="true">
          {icon}
        </span>
      )}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-zt-text-primary">{title}</p>
        {description && (
          <p className="text-xs text-zt-text-secondary max-w-xs">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
