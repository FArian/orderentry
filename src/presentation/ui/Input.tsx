"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix" | "suffix"> {
  label?: string;
  error?: string;
  hint?: string;
  /** Leading icon or text (e.g. emoji, SVG) */
  prefix?: ReactNode;
  /** Trailing icon or text */
  suffix?: ReactNode;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Design-system Input.
 *
 * Required fields show a red asterisk after the label (aria-hidden — the
 * `required` attribute already communicates this to screen readers).
 *
 * @example
 * <Input label="Name" placeholder="Max Mustermann" required />
 * <Input prefix="🔍" placeholder="Suchen…" onChange={handleSearch} />
 * <Input label="GLN" error="13 Stellen erforderlich" />
 */
export function Input({
  label,
  error,
  hint,
  prefix,
  suffix,
  id,
  className = "",
  disabled,
  ...rest
}: InputProps) {
  const inputId = id ?? `input-${Math.random().toString(36).slice(2, 7)}`;
  const hasError = !!error;

  const borderClass = hasError
    ? "border-zt-danger focus:border-zt-danger focus:ring-zt-danger-border"
    : "border-zt-border focus:border-zt-primary focus:ring-zt-primary-border";

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-zt-text-primary select-none"
        >
          {label}
          {rest.required && (
            <span className="ml-0.5 text-zt-danger" aria-hidden="true">*</span>
          )}
        </label>
      )}

      <div className="relative flex items-center">
        {prefix && (
          <span className="pointer-events-none absolute left-2.5 text-zt-text-tertiary select-none text-sm">
            {prefix}
          </span>
        )}
        <input
          id={inputId}
          disabled={disabled}
          aria-invalid={hasError}
          aria-describedby={
            error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
          }
          className={[
            "w-full rounded border bg-zt-bg-card py-1.5 text-sm text-zt-text-primary",
            "placeholder-zt-text-tertiary transition-colors duration-150",
            "focus:outline-none focus:ring-2",
            "disabled:cursor-not-allowed disabled:bg-zt-bg-muted disabled:text-zt-text-disabled",
            prefix ? "pl-8" : "pl-3",
            suffix ? "pr-8" : "pr-3",
            borderClass,
          ].join(" ")}
          {...rest}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2.5 text-zt-text-tertiary select-none text-sm">
            {suffix}
          </span>
        )}
      </div>

      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-zt-danger">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${inputId}-hint`} className="text-xs text-zt-text-secondary">
          {hint}
        </p>
      )}
    </div>
  );
}
