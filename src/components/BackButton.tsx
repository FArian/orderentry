"use client";

/**
 * BackButton — navigates one step back in browser history.
 * Used in page breadcrumbs across all main pages.
 */

import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";

export function BackButton() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="inline-flex items-center gap-1 text-[12px] text-zt-text-secondary hover:text-zt-primary transition-colors"
      aria-label={t("common.back")}
    >
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
        <path d="M8.5 2L4 6.5l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {t("common.back")}
    </button>
  );
}
