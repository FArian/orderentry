"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

export default function Home() {
  const { t } = useTranslation();

  return (
    <main className="mx-auto max-w-5xl px-6 min-h-[calc(100vh-96px)] flex flex-col items-center justify-center">
      <h1 className="text-2xl sm:text-3xl font-semibold text-center">
        {t("home.title")}
      </h1>

      <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
        <Link
          href="/patients"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-6 py-3 text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          📋 {t("home.order")}
        </Link>
        <Link
          href="/orders"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-gray-100 px-6 py-3 text-gray-900 shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          📤 {t("home.orders")}
        </Link>
        <Link
          href="/patients"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-6 py-3 text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          🔬 {t("befunde.title")}
        </Link>
      </div>
    </main>
  );
}
