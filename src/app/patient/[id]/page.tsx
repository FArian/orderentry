"use client";

import PatientDetailClient from "./PatientDetailClient";
import PatientBreadcrumb from "./PatientBreadcrumb";
import { useTranslation } from "@/lib/i18n";

export default function PatientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const { t } = useTranslation();

  return (
    <div className="p-4">
      <PatientBreadcrumb id={id} />
      <h1 className="mb-4 text-2xl font-bold">{t("patient.title")}</h1>
      <PatientDetailClient id={id} />
    </div>
  );
}
