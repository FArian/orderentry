"use client";

import type { HTMLAttributes, ReactNode } from "react";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  /** Extra content rendered in the header row alongside title */
  headerAction?: ReactNode;
  noPadding?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Design-system Card — a content container with consistent border and shadow.
 *
 * @example
 * <Card title="Patient" subtitle="Demografische Daten">
 *   <p>Max Mustermann</p>
 * </Card>
 */
export function Card({
  title,
  subtitle,
  headerAction,
  noPadding = false,
  children,
  className = "",
  ...rest
}: CardProps) {
  const hasHeader = title || subtitle || headerAction;

  return (
    <div
      {...rest}
      className={[
        "rounded-lg border border-gray-200 bg-white shadow-sm",
        className,
      ].join(" ")}
    >
      {hasHeader && (
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-semibold text-gray-800 leading-tight">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
            )}
          </div>
          {headerAction && (
            <div className="shrink-0">{headerAction}</div>
          )}
        </div>
      )}
      <div className={noPadding ? "" : "p-4"}>{children}</div>
    </div>
  );
}
