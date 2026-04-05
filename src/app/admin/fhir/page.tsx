"use client";

// FhirRegistryPage uses useSearchParams() — Suspense boundary is required by Next.js 15.
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import FhirRegistryPage from "@/presentation/pages/FhirRegistryPage";

export default function AdminFhirRoute() {
  return (
    <Suspense>
      <FhirRegistryPage />
    </Suspense>
  );
}
