"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";

const NAV_LINKS = [
  { href: "/patient", labelKey: "nav.patients" },
  { href: "/orders",  labelKey: "nav.orders"   },
  { href: "/results", labelKey: "nav.results"  },
] as const;

export function AppHeaderNav() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <nav aria-label="Navigation" className="hidden md:flex items-center gap-0.5">
      {NAV_LINKS.map(({ href, labelKey }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              active
                ? "bg-zt-primary-light text-zt-primary"
                : "text-zt-text-secondary hover:text-zt-text-primary hover:bg-zt-bg-muted"
            }`}
          >
            {t(labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
