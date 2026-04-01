"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PatientBreadcrumb from "../../patient/[id]/PatientBreadcrumb";
import OrderClient from "./OrderClient";
import { useTranslation } from "@/lib/i18n";

function OrderPageInner({ id }: { id: string }) {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const srId = searchParams.get("sr") || undefined;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="p-4">
        <PatientBreadcrumb id={id} hideNewOrder />
        <h1 className="text-2xl font-bold">
          {srId ? t("order.editTitle") : t("order.title")}
        </h1>
      </div>
      <OrderClient id={id} srId={srId} />
    </div>
  );
}

export default function OrderPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <Suspense fallback={<div className="p-4 text-gray-500">…</div>}>
      <OrderPageInner id={params.id} />
    </Suspense>
  );
}
