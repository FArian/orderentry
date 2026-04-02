"use client";

import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import OrderClient from "./OrderClient";

/**
 * Thin route wrapper — all breadcrumb, patient context, and layout chrome
 * lives inside OrderFormView so the component owns its full viewport slice.
 */
function OrderPageInner({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const srIdRaw = searchParams.get("sr") || undefined;
  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: "calc(100vh - var(--zt-topbar-height))" }}
    >
      <OrderClient id={id} {...(srIdRaw !== undefined && { srId: srIdRaw })} />
    </div>
  );
}

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense
      fallback={
        <div
          className="flex items-center justify-center text-sm text-zt-text-tertiary"
          style={{ height: "calc(100vh - var(--zt-topbar-height))" }}
        >
          …
        </div>
      }
    >
      <OrderPageInner id={id} />
    </Suspense>
  );
}
