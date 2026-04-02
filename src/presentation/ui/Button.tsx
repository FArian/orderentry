"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

// ── Variants ──────────────────────────────────────────────────────────────────

const VARIANT_CLASSES = {
  primary:   "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-300 disabled:border-blue-300",
  secondary: "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 focus:ring-gray-400 disabled:bg-gray-100 disabled:text-gray-400",
  danger:    "bg-white text-red-600 border-red-300 hover:bg-red-50 focus:ring-red-400 disabled:opacity-40",
  ghost:     "bg-transparent text-gray-600 border-transparent hover:bg-gray-100 focus:ring-gray-400 disabled:opacity-40",
} as const;

const SIZE_CLASSES = {
  sm:  "px-2.5 py-1    text-xs gap-1",
  md:  "px-3.5 py-1.5  text-sm gap-1.5",
  lg:  "px-5   py-2.5  text-base gap-2",
} as const;

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANT_CLASSES;
  size?: keyof typeof SIZE_CLASSES;
  loading?: boolean;
  icon?: ReactNode;
  /** Place icon after label instead of before */
  iconAfter?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Design-system Button.
 *
 * @example
 * <Button variant="primary" onClick={handleSave}>Speichern</Button>
 * <Button variant="danger" loading={isDeleting}>Löschen</Button>
 * <Button variant="secondary" icon="↻" size="sm">Aktualisieren</Button>
 */
export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  icon,
  iconAfter = false,
  disabled,
  children,
  className = "",
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...rest}
      disabled={isDisabled}
      className={[
        "inline-flex items-center justify-center",
        "rounded border font-medium",
        "transition-colors duration-150",
        "focus:outline-none focus:ring-2 focus:ring-offset-1",
        "disabled:cursor-not-allowed",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {loading && <Spinner />}
      {!loading && icon && !iconAfter && (
        <span aria-hidden="true">{icon}</span>
      )}
      {children && <span>{children}</span>}
      {!loading && icon && iconAfter && (
        <span aria-hidden="true">{icon}</span>
      )}
    </button>
  );
}

// ── Spinner (used by Button internally, also exported for standalone use) ──────

export function Spinner({ size = "sm" }: { size?: "sm" | "md" | "lg" }) {
  const dim = { sm: "h-3.5 w-3.5", md: "h-5 w-5", lg: "h-6 w-6" }[size];
  return (
    <span
      className={`${dim} animate-spin rounded-full border-2 border-current border-t-transparent`}
      role="status"
      aria-label="Laden…"
    />
  );
}
