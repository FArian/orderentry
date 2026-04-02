"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

export default function Home() {
  const { t } = useTranslation();

  return (
    <main className="mx-auto max-w-5xl px-6 min-h-[calc(100vh-96px)] flex flex-col items-center justify-center">
      <h1 className="text-2xl sm:text-3xl font-semibold text-center text-zt-text-primary">
        {t("home.title")}
      </h1>

      <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
        <Link
          href="/patients"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-zt-primary px-6 py-3 text-zt-text-on-primary shadow-sm hover:bg-zt-primary-hover focus:outline-none focus:ring-2 focus:ring-zt-primary-border"
        >
          📋 {t("home.order")}
        </Link>
        <Link
          href="/orders"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-zt-bg-card border border-zt-border px-6 py-3 text-zt-text-primary shadow-sm hover:bg-zt-bg-muted focus:outline-none focus:ring-2 focus:ring-zt-border-strong"
        >
          📤 {t("home.orders")}
        </Link>
        <Link
          href="/results"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-zt-success px-6 py-3 text-zt-text-on-success shadow-sm hover:bg-zt-success-hover focus:outline-none focus:ring-2 focus:ring-zt-success-border"
        >
          🔬 {t("results.title")}
        </Link>
      </div>
    </main>
  );
}
