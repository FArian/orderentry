"use client";

// useSearchParams in FhirRegistryPage requires opt-out of static prerendering
export const dynamic = "force-dynamic";

import FhirRegistryPage from "@/presentation/pages/FhirRegistryPage";

export default function AdminFhirRoute() {
  return <FhirRegistryPage />;
}
