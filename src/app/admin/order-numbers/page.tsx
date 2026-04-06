import { Suspense } from "react";
import OrderNumbersPage from "@/presentation/pages/OrderNumbersPage";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense>
      <OrderNumbersPage />
    </Suspense>
  );
}
