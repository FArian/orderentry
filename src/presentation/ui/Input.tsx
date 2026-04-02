"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
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
 * @example
 * <Input label="Name" placeholder="Max Mustermann" />
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
    ? "border-red-400 focus:border-red-500 focus:ring-red-300"
    : "border-gray-300 focus:border-blue-400 focus:ring-blue-200";

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-gray-700 select-none"
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {prefix && (
          <span className="pointer-events-none absolute left-2.5 text-gray-400 select-none text-sm">
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
            "w-full rounded border bg-white py-1.5 text-sm text-gray-800",
            "placeholder-gray-400 transition-colors duration-150",
            "focus:outline-none focus:ring-2",
            "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400",
            prefix ? "pl-8" : "pl-3",
            suffix ? "pr-8" : "pr-3",
            borderClass,
          ].join(" ")}
          {...rest}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2.5 text-gray-400 select-none text-sm">
            {suffix}
          </span>
        )}
      </div>

      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${inputId}-hint`} className="text-xs text-gray-500">
          {hint}
        </p>
      )}
    </div>
  );
}
