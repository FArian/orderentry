"use client";

import Link from "next/link";
import { use } from "react";
import PatientDetailClient from "./PatientDetailClient";
import PatientBreadcrumb from "./PatientBreadcrumb";
import { useTranslation } from "@/lib/i18n";

export default function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useTranslation();

  return (
    <div className="p-4">
      <PatientBreadcrumb id={id} />

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("patient.title")}</h1>
        <Link
          href={`/order/${id}`}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          {t("home.order")}
        </Link>
      </div>

      <PatientDetailClient id={id} />
    </div>
  );
}
