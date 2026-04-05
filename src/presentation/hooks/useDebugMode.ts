"use client";

import { useEffect, useState } from "react";

export function useDebugMode(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/v1/admin/debug", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.resolve({ enabled: false })))
      .then((json: { enabled: boolean }) => setEnabled(json.enabled))
      .catch(() => setEnabled(false));
  }, []);

  return enabled;
}
