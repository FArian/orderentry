"use client";

/**
 * RoleTagInput — tag-based multi-select for PractitionerRoles.
 *
 * Purely presentational: all data is passed via props.
 * The parent provides the catalog (from useRoles) and controls the value.
 *
 * Interaction:
 *  • Selected roles appear as removable tags above the input.
 *  • Typing filters the catalog by code or display name.
 *  • Clicking a suggestion adds it (if not already selected).
 *  • If the typed text matches nothing, an "Add custom: X" option appears.
 *  • Pressing Enter with typed text selects the highlighted suggestion or
 *    adds the custom text.
 *  • onMouseDown preventDefault on suggestions prevents blur-before-click.
 */

import { useRef, useState } from "react";
import type { RoleCatalogEntryDto } from "@/infrastructure/api/dto/RoleDto";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RoleTagInputProps {
  value:    string[];                          // selected role codes / labels
  onChange: (roles: string[]) => void;
  catalog:  RoleCatalogEntryDto[];
  label?:   string;
  error?:   string;
  placeholder?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RoleTagInput({
  value,
  onChange,
  catalog,
  label,
  error,
  placeholder = "Rolle suchen oder eingeben…",
}: RoleTagInputProps) {
  const [query,   setQuery]   = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef              = useRef<HTMLInputElement>(null);

  // ── Suggestions ─────────────────────────────────────────────────────────────

  const q = query.trim().toLowerCase();

  const suggestions = q
    ? catalog.filter(
        (r) =>
          !value.includes(r.code) &&
          (r.code.toLowerCase().includes(q) || r.display.toLowerCase().includes(q)),
      )
    : catalog.filter((r) => !value.includes(r.code));

  const exactMatch = catalog.some(
    (r) => r.code.toLowerCase() === q || r.display.toLowerCase() === q,
  );
  const showCustom = q.length > 0 && !exactMatch && !value.includes(query.trim());

  const showDropdown = focused && (suggestions.length > 0 || showCustom);

  // ── Actions ──────────────────────────────────────────────────────────────────

  function addRole(code: string) {
    if (!code.trim() || value.includes(code)) return;
    onChange([...value, code]);
    setQuery("");
    inputRef.current?.focus();
  }

  function removeRole(code: string) {
    onChange(value.filter((r) => r !== code));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const first = suggestions[0];
      if (first) {
        addRole(first.code);
      } else if (showCustom && query.trim()) {
        addRole(query.trim());
      }
    }
    if (e.key === "Backspace" && !query && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  // ── Styling ──────────────────────────────────────────────────────────────────

  const containerCls =
    "flex flex-wrap gap-1.5 px-2.5 py-2 min-h-[40px] border rounded-lg bg-zt-bg-page " +
    "text-zt-text-primary cursor-text transition-colors " +
    (error
      ? "border-zt-danger focus-within:ring-2 focus-within:ring-zt-danger/20"
      : focused
        ? "border-zt-primary ring-2 ring-zt-primary/10"
        : "border-zt-border hover:border-zt-border-strong");

  return (
    <div className="relative">
      {label && (
        <label className="block text-[12px] font-medium text-zt-text-secondary mb-1">
          {label}
        </label>
      )}

      {/* Tag container + input */}
      <div
        className={containerCls}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Selected role tags */}
        {value.map((code) => {
          const entry = catalog.find((r) => r.code === code);
          const display = entry ? `${entry.code} — ${entry.display}` : code;
          return (
            <span
              key={code}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium
                bg-zt-primary/10 text-zt-primary border border-zt-primary/20"
            >
              {display}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeRole(code); }}
                aria-label={`${code} entfernen`}
                className="ml-0.5 text-zt-primary/60 hover:text-zt-danger leading-none"
              >
                ×
              </button>
            </span>
          );
        })}

        {/* Search input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] text-[13px] bg-transparent outline-none placeholder:text-zt-text-tertiary"
        />
      </div>

      {/* Suggestion dropdown */}
      {showDropdown && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1
          bg-zt-bg-card border border-zt-border rounded-lg shadow-lg
          max-h-48 overflow-y-auto py-1">

          {suggestions.map((r) => (
            <button
              key={r.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()} // prevent blur before click
              onClick={() => addRole(r.code)}
              className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left
                hover:bg-zt-bg-muted text-zt-text-primary"
            >
              <span className="font-mono text-[11px] text-zt-text-tertiary w-16 shrink-0">
                {r.code}
              </span>
              <span>{r.display}</span>
              {r.system && (
                <span className="ml-auto text-[10px] text-zt-text-tertiary truncate max-w-[120px]">
                  {r.system}
                </span>
              )}
            </button>
          ))}

          {showCustom && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addRole(query.trim())}
              className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left
                hover:bg-zt-bg-muted text-zt-text-secondary border-t border-zt-border"
            >
              <span className="text-zt-primary font-medium">+</span>
              <span>
                Eigene Rolle hinzufügen:{" "}
                <span className="font-medium text-zt-text-primary">{query.trim()}</span>
              </span>
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="mt-1 text-[11px] text-zt-danger">{error}</p>
      )}
    </div>
  );
}
