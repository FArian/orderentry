"use client";

import Image from "next/image";
import Link from "next/link";
import { AppHeaderNav } from "./AppHeaderNav";
import { AppHeaderRefreshControl } from "./AppHeaderRefreshControl";
import { UserMenu } from "./UserMenu";

export default function AppHeader({ version }: { version: string }) {
  return (
    <header
      className="w-full border-b bg-zt-topbar-bg border-zt-topbar-border"
      style={{ boxShadow: "var(--zt-shadow-sm)" }}
    >
      <div
        className="mx-auto max-w-7xl px-3 sm:px-4 flex items-center gap-3 sm:gap-4"
        style={{ height: "var(--zt-topbar-height)" }}
      >
        {/* Brand */}
        <Link
          href="/"
          aria-label="Startseite"
          title={`z2Lab ${version}`}
          className="flex items-center gap-2 shrink-0"
        >
          <Image
            src="/logo.svg"
            alt="z2Lab logo"
            width={28}
            height={28}
            className="h-7 w-auto select-none"
          />
          <span className="hidden sm:inline font-semibold text-zt-text-primary text-sm tracking-tight">
            z2Lab
          </span>
        </Link>

        {/* Divider */}
        <span className="hidden sm:block h-5 w-px bg-zt-border shrink-0" aria-hidden="true" />

        {/* Primary navigation */}
        <AppHeaderNav />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Refresh controls */}
        <AppHeaderRefreshControl />

        {/* User menu: locale switcher + avatar dropdown */}
        <UserMenu />
      </div>
    </header>
  );
}
