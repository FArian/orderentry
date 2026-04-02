"use client";

import type { SelectHTMLAttributes } from "react";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Design-system Select.
 *
 * @example
 * <Select
 *   label="Status"
 *   options={[{ value: 'final', label: 'Abgeschlossen' }]}
 *   placeholder="Alle Status"
 * />
 */
export function Select({
  label,
  error,
  hint,
  options,
  placeholder,
  id,
  className = "",
  disabled,
  ...rest
}: SelectProps) {
  const selectId = id ?? `select-${Math.random().toString(36).slice(2, 7)}`;
  const hasError = !!error;

  const borderClass = hasError
    ? "border-zt-danger focus:border-zt-danger focus:ring-zt-danger-border"
    : "border-zt-border focus:border-zt-primary focus:ring-zt-primary-border";

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label
          htmlFor={selectId}
          className="text-sm font-medium text-zt-text-primary select-none"
        >
          {label}
        </label>
      )}

      <select
        id={selectId}
        disabled={disabled}
        aria-invalid={hasError}
        aria-describedby={
          error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined
        }
        className={[
          "w-full rounded border bg-zt-bg-card px-3 py-1.5 text-sm text-zt-text-primary",
          "transition-colors duration-150 appearance-none",
          "focus:outline-none focus:ring-2",
          "disabled:cursor-not-allowed disabled:bg-zt-bg-muted disabled:text-zt-text-disabled",
          borderClass,
        ].join(" ")}
        {...rest}
      >
        {placeholder && (
          <option value="">{placeholder}</option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {error && (
        <p id={`${selectId}-error`} role="alert" className="text-xs text-zt-danger">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${selectId}-hint`} className="text-xs text-zt-text-secondary">
          {hint}
        </p>
      )}
    </div>
  );
}
