"use client";

/**
 * OrderClient — thin client boundary wrapper.
 *
 * The actual implementation lives in:
 *   src/presentation/pages/OrderCreatePage.tsx  (container)
 *   src/presentation/pages/OrderFormView.tsx     (presentational)
 *   src/presentation/hooks/useOrderCatalog.ts    (FHIR catalog state)
 *   src/presentation/hooks/useOrderForm.ts       (form / patient state)
 *   src/presentation/hooks/useOrderDocuments.ts  (document building / print)
 */

import OrderCreatePage from "@/presentation/pages/OrderCreatePage";

export default function OrderClient({ id, srId }: { id: string; srId?: string }) {
  return <OrderCreatePage id={id} {...(srId !== undefined ? { srId } : {})} />;
}
