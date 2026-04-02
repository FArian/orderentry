"use client";

/**
 * Dropdown — generic positioned panel attached to a trigger element.
 *
 * Responsibilities:
 *  • Renders trigger + panel together
 *  • Handles click-outside to close
 *  • Handles Escape key to close and return focus to trigger
 *  • Handles Tab key: closes the panel (focus moves naturally to next element)
 *  • Applies the .zt-dropdown-enter animation when opening
 *  • Pure UI — no knowledge of what the trigger or items are
 *
 * Usage:
 *   <Dropdown
 *     isOpen={open}
 *     onClose={() => setOpen(false)}
 *     trigger={<button onClick={() => setOpen(o => !o)}>Menu</button>}
 *     align="right"
 *   >
 *     <DropdownItem ...>Profile</DropdownItem>
 *   </Dropdown>
 */

import { useEffect, useRef, type ReactNode } from "react";

// ── DropdownItem ──────────────────────────────────────────────────────────────

export interface DropdownItemProps {
  /** Icon or emoji shown to the left. */
  icon?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  /** Renders an anchor instead of a button (full-page navigation). */
  href?: string;
  /** Red destructive styling (e.g. Logout). */
  variant?: "default" | "danger";
  /** Visually disabled — no interaction. */
  disabled?: boolean;
  /** Button type — use "submit" when the item is inside a <form>. Defaults to "button". */
  type?: "button" | "submit" | "reset";
}

export function DropdownItem({
  icon,
  children,
  onClick,
  href,
  variant = "default",
  disabled = false,
  type = "button",
}: DropdownItemProps) {
  const base =
    "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors duration-100 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-zt-primary/40";

  const variantClass =
    variant === "danger"
      ? disabled
        ? "text-zt-text-disabled cursor-not-allowed"
        : "text-zt-danger hover:bg-zt-danger-light"
      : disabled
      ? "text-zt-text-disabled cursor-not-allowed"
      : "text-zt-text-primary hover:bg-zt-bg-muted";

  const cls = `${base} ${variantClass}`;

  if (href && !disabled) {
    return (
      <a href={href} className={cls}>
        {icon && <span className="shrink-0 w-4 text-center leading-none">{icon}</span>}
        <span>{children}</span>
      </a>
    );
  }

  return (
    <button type={type} onClick={disabled ? undefined : onClick} disabled={disabled} className={cls}>
      {icon && <span className="shrink-0 w-4 text-center leading-none">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

// ── DropdownSeparator ─────────────────────────────────────────────────────────

export function DropdownSeparator() {
  return <div className="my-1 h-px bg-zt-border" role="separator" />;
}

// ── DropdownLabel ─────────────────────────────────────────────────────────────

export function DropdownLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 py-1.5 text-xs font-medium text-zt-text-tertiary uppercase tracking-wide select-none">
      {children}
    </div>
  );
}

// ── Dropdown ──────────────────────────────────────────────────────────────────

export interface DropdownProps {
  isOpen: boolean;
  onClose: () => void;
  /** The element that opens the dropdown. Rendered as-is (must handle its own onClick). */
  trigger: ReactNode;
  children: ReactNode;
  /** Panel alignment relative to the trigger container. */
  align?: "left" | "right";
  /** Minimum width of the panel in px. */
  minWidth?: number;
}

export function Dropdown({
  isOpen,
  onClose,
  trigger,
  children,
  align = "right",
  minWidth = 200,
}: DropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Click outside ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen, onClose]);

  // ── Keyboard: Escape + Tab ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        // Return focus to whatever triggered the open — the trigger element
        const trigger = containerRef.current?.querySelector<HTMLElement>("[data-dropdown-trigger]");
        trigger?.focus();
      }
      if (e.key === "Tab") {
        // Allow natural tab flow but close the panel
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // ── Focus first item when opening ──────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const first = panelRef.current?.querySelector<HTMLElement>(
      'a, button:not([disabled])'
    );
    first?.focus();
  }, [isOpen]);

  const alignClass = align === "right" ? "right-0" : "left-0";

  return (
    <div ref={containerRef} className="relative inline-block">
      {trigger}

      {isOpen && (
        <div
          ref={panelRef}
          role="menu"
          aria-orientation="vertical"
          className={`zt-dropdown-enter absolute top-full mt-1.5 ${alignClass} z-[200]
            rounded-lg border border-zt-border bg-zt-bg-card
            shadow-[var(--zt-shadow-lg)]
            py-1.5 focus:outline-none`}
          style={{ minWidth }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
