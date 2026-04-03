"use client";

import { useId } from "react";
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

// ── Chevron icon ──────────────────────────────────────────────────────────────

function ChevronDown() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2 4L6 8L10 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Design-system Select.
 *
 * Required fields show a red asterisk after the label.
 *
 * @example
 * <Select
 *   label="Status"
 *   options={[{ value: 'final', label: 'Abgeschlossen' }]}
 *   placeholder="Alle Status"
 *   required
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
  const generatedId = useId();
  const selectId    = id ?? `select-${generatedId}`;
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
          {rest.required && (
            <span className="ml-0.5 text-zt-danger" aria-hidden="true">*</span>
          )}
        </label>
      )}

      {/* Wrapper provides positioning context for the custom chevron */}
      <div className="relative flex items-center">
        <select
          id={selectId}
          disabled={disabled}
          aria-invalid={hasError}
          aria-describedby={
            error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined
          }
          className={[
            "w-full rounded border bg-zt-bg-card pl-3 pr-8 py-1.5 text-sm text-zt-text-primary",
            "transition-colors duration-150 appearance-none cursor-pointer",
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

        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zt-text-tertiary">
          <ChevronDown />
        </span>
      </div>

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
