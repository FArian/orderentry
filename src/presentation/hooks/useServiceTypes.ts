"use client";

/**
 * useServiceTypes — loads the active order service types at runtime.
 *
 * Priority (server-side, via /api/v1/config/service-types):
 *   1. ORDER_SERVICE_TYPES env var (explicit override)
 *   2. Distinct ActivityDefinition.topic codes from the FHIR server (5-min cache)
 *   3. Built-in fallback: ["MIBI", "ROUTINE", "POC"]
 *
 * While loading the initial AppConfig.serviceTypes value is used so the UI
 * is never empty.
 */

import { useEffect, useState } from "react";
import { AppConfig }           from "@/shared/config/AppConfig";

export interface UseServiceTypesResult {
  serviceTypes: string[];
  loading:      boolean;
}

export function useServiceTypes(): UseServiceTypesResult {
  const [serviceTypes, setServiceTypes] = useState<string[]>([...AppConfig.serviceTypes]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    fetch("/api/v1/config/service-types")
      .then((r) => r.json())
      .then((data: { types?: string[] }) => {
        if (Array.isArray(data.types) && data.types.length > 0) {
          setServiceTypes(data.types);
        }
      })
      .catch(() => { /* keep AppConfig fallback */ })
      .finally(() => setLoading(false));
  }, []);

  return { serviceTypes, loading };
}
