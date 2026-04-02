"use client";

/**
 * UserMenu — enterprise-style user menu for the top-right corner of AppHeader.
 *
 * Composes:
 *  • LocaleSwitcher  — language buttons (de/fr/it/en)
 *  • Avatar          — initials circle
 *  • Dropdown        — positioned panel with keyboard/click-outside handling
 *
 * Data:
 *  • Reads the shared SessionContext (populated by SessionProvider in Providers.tsx).
 *    A single /api/me fetch serves both this component and AppSidebar.
 *
 * Sections in the dropdown:
 *  ┌────────────────────────┐
 *  │  FA  Farhad Arian      │  ← user header (role badge for admin)
 *  │      farian  [Admin]   │
 *  ├────────────────────────┤
 *  │  👤  Profil            │
 *  │  ⚙️  Einstellungen    │
 *  ├────────────────────────┤
 *  │  ←   Uuslogge          │  ← danger variant
 *  └────────────────────────┘
 */

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { useSession } from "@/lib/session";
import { Avatar } from "@/presentation/ui/Avatar";
import {
  Dropdown,
  DropdownItem,
  DropdownSeparator,
} from "@/presentation/ui/Dropdown";

// ── Locale labels ─────────────────────────────────────────────────────────────

const LOCALE_FLAGS: Record<string, { flag: string; label: string }> = {
  "de-CH": { flag: "🇨🇭", label: "Schweizerdeutsch" },
  de:      { flag: "🇩🇪", label: "Deutsch" },
  fr:      { flag: "🇫🇷", label: "Français" },
  it:      { flag: "🇮🇹", label: "Italiano" },
  en:      { flag: "🇬🇧", label: "English" },
};

// ── LocaleSwitcher ────────────────────────────────────────────────────────────

function LocaleSwitcher() {
  const { locale, setLocale, availableLocales } = useTranslation();
  return (
    <div
      role="group"
      aria-label="Sprachauswahl"
      className="flex rounded overflow-hidden border border-zt-border text-xs"
    >
      {availableLocales.map((loc) => {
        const meta = LOCALE_FLAGS[loc] ?? { flag: loc.toUpperCase(), label: loc };
        return (
          <button
            key={loc}
            onClick={() => setLocale(loc)}
            aria-label={`Sprache: ${meta.label}`}
            title={meta.label}
            aria-pressed={locale === loc}
            className={`px-1.5 sm:px-2 py-0.5 text-base leading-none transition-colors ${
              locale === loc
                ? "bg-zt-primary text-zt-text-on-primary"
                : "bg-zt-bg-card text-zt-text-secondary hover:bg-zt-bg-muted"
            }`}
          >
            {meta.flag}
          </button>
        );
      })}
    </div>
  );
}

// ── UserMenu ──────────────────────────────────────────────────────────────────

export function UserMenu() {
  const { t } = useTranslation();
  const { status, user, isAdmin } = useSession();
  const [open, setOpen] = useState(false);

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <LocaleSwitcher />
        <span className="hidden sm:block h-4 w-px bg-zt-border" aria-hidden="true" />
        <span
          className="h-8 w-28 rounded-md bg-zt-bg-muted animate-pulse"
          aria-hidden="true"
        />
      </div>
    );
  }

  // ── Unauthenticated ────────────────────────────────────────────────────────
  if (status === "unauthenticated" || !user) {
    return (
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <LocaleSwitcher />
        <span className="hidden sm:block h-4 w-px bg-zt-border" aria-hidden="true" />
        <Link
          href="/login"
          className="text-sm text-zt-primary hover:underline font-medium"
        >
          {t("nav.login")}
        </Link>
      </div>
    );
  }

  // ── Authenticated ──────────────────────────────────────────────────────────

  const trigger = (
    <button
      data-dropdown-trigger
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-expanded={open}
      aria-haspopup="menu"
      aria-label={`${t("nav.userMenu")}: ${user.username}`}
      className={`
        flex items-center gap-2 rounded-md px-2 py-1.5
        text-sm text-zt-text-primary
        border border-transparent
        transition-colors duration-100
        hover:bg-zt-bg-muted hover:border-zt-border
        focus:outline-none focus-visible:ring-2 focus-visible:ring-zt-primary/40
        ${open ? "bg-zt-bg-muted border-zt-border" : ""}
      `}
    >
      <Avatar username={user.username} size="sm" />
      <span className="hidden sm:block max-w-[9rem] truncate font-medium leading-tight">
        {user.username}
      </span>
      {/* Chevron */}
      <svg
        className={`hidden sm:block h-3 w-3 shrink-0 text-zt-text-tertiary transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M2 4L6 8L10 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );

  return (
    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
      <LocaleSwitcher />
      <span className="hidden sm:block h-4 w-px bg-zt-border" aria-hidden="true" />

      <Dropdown
        isOpen={open}
        onClose={() => setOpen(false)}
        trigger={trigger}
        align="right"
        minWidth={220}
      >
        {/* User header — identity + role at a glance */}
        <div className="flex items-center gap-3 px-3 py-2.5 border-b border-zt-border mb-1">
          <Avatar username={user.username} size="md" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-zt-text-primary truncate leading-tight">
                {user.username}
              </span>
              {isAdmin && (
                <span className="shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold leading-none bg-zt-primary text-zt-text-on-primary">
                  Admin
                </span>
              )}
            </div>
            <div className="text-xs text-zt-text-tertiary truncate leading-tight mt-0.5">
              {t("nav.signedIn")}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <DropdownItem icon="👤" href="/profile">
          {t("nav.profile")}
        </DropdownItem>
        <DropdownItem icon="⚙️" href="/settings">
          {t("nav.settings")}
        </DropdownItem>

        <DropdownSeparator />

        {/* Logout — POST via fetch then navigate; avoids browser POST-redirect quirks */}
        <DropdownItem
          icon={
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
              <path
                d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M10 11l3-3-3-3M13 8H6"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
          variant="danger"
          onClick={async () => {
            setOpen(false);
            // POST clears both the server-signed session cookie and the local
            // fallback cookie.  We then navigate explicitly — no redirect chain.
            try {
              await fetch("/api/logout", { method: "POST" });
            } finally {
              window.location.assign("/login");
            }
          }}
        >
          {t("nav.logout")}
        </DropdownItem>
      </Dropdown>
    </div>
  );
}
