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
 *  • Fetches the current session from /api/me on mount and on every pathname change.
 *  • Derives username from session; shows a skeleton while loading.
 *
 * Sections in the dropdown:
 *  ┌────────────────────────┐
 *  │  FA  Farhad Arian      │  ← user header (not clickable)
 *  │      farian            │
 *  ├────────────────────────┤
 *  │  👤  Profil            │
 *  │  ⚙️  Einstellungen    │
 *  ├────────────────────────┤
 *  │  ←   Uuslogge          │  ← danger variant
 *  └────────────────────────┘
 */

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { Avatar } from "@/presentation/ui/Avatar";
import {
  Dropdown,
  DropdownItem,
  DropdownSeparator,
} from "@/presentation/ui/Dropdown";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionUser {
  id: string;
  username: string;
}

type SessionState =
  | { status: "loading" }
  | { status: "authenticated"; user: SessionUser }
  | { status: "unauthenticated" };

// ── Locale labels ─────────────────────────────────────────────────────────────

const LOCALE_LABELS: Record<string, string> = {
  "de-CH": "DE",
  de:      "DE",
  fr:      "FR",
  it:      "IT",
  en:      "EN",
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
      {availableLocales.map((loc) => (
        <button
          key={loc}
          onClick={() => setLocale(loc)}
          aria-label={`Sprache: ${LOCALE_LABELS[loc] ?? loc.toUpperCase()}`}
          aria-pressed={locale === loc}
          className={`px-1.5 sm:px-2 py-0.5 transition-colors ${
            locale === loc
              ? "bg-zt-primary text-zt-text-on-primary font-semibold"
              : "bg-zt-bg-card text-zt-text-secondary hover:bg-zt-bg-muted"
          }`}
        >
          {(LOCALE_LABELS[loc] ?? loc).toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// ── UserMenu ──────────────────────────────────────────────────────────────────

export function UserMenu() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const [open, setOpen] = useState(false);

  // ── Session fetch ──────────────────────────────────────────────────────────
  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (!res.ok) { setSession({ status: "unauthenticated" }); return; }
      const data = await res.json();
      setSession(
        data?.authenticated && data?.user
          ? { status: "authenticated", user: data.user as SessionUser }
          : { status: "unauthenticated" }
      );
    } catch {
      setSession({ status: "unauthenticated" });
    }
  }, []);

  useEffect(() => { fetchSession(); }, [fetchSession, pathname]);

  // ── Unauthenticated / loading ──────────────────────────────────────────────
  if (session.status === "loading") {
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

  if (session.status === "unauthenticated") {
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
  const { user } = session;

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
        {/* User header — identity at a glance */}
        <div className="flex items-center gap-3 px-3 py-2.5 border-b border-zt-border mb-1">
          <Avatar username={user.username} size="md" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-zt-text-primary truncate leading-tight">
              {user.username}
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

        {/* Logout — POST to /api/logout via a form */}
        <form
          action="/api/logout"
          method="post"
          onSubmit={() => setOpen(false)}
        >
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
            onClick={() => {
              // The form submission handles the actual logout;
              // this closes the dropdown immediately for responsiveness.
              setOpen(false);
            }}
          >
            {t("nav.logout")}
          </DropdownItem>
        </form>
      </Dropdown>
    </div>
  );
}
