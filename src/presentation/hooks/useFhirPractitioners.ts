"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  FhirPractitionerDto,
  CreatePractitionerRequestDto,
} from "@/infrastructure/api/dto/FhirRegistryDto";

interface UseFhirPractitionersResult {
  practitioners: FhirPractitionerDto[];
  loading:            boolean;
  error:              string | null;
  reload:             () => void;
  createPractitioner: (dto: CreatePractitionerRequestDto) => Promise<FhirPractitionerDto>;
}

export function useFhirPractitioners(): UseFhirPractitionersResult {
  const [practitioners, setPractitioners] = useState<FhirPractitionerDto[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [rev,           setRev]           = useState(0);

  const reload = useCallback(() => setRev((r) => r + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);

    fetch("/api/fhir/practitioners", { signal: ctrl.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((data: { practitioners?: FhirPractitionerDto[]; error?: string }) => {
        if (data.error) setError(data.error);
        else setPractitioners(data.practitioners ?? []);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string }).name !== "AbortError") {
          setError(e instanceof Error ? e.message : "Load failed");
        }
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [rev]);

  const createPractitioner = useCallback(
    async (dto: CreatePractitionerRequestDto): Promise<FhirPractitionerDto> => {
      const res = await fetch("/api/fhir/practitioners", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(dto),
      });
      const data = (await res.json()) as FhirPractitionerDto & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
      reload();
      return data;
    },
    [reload],
  );

  return { practitioners, loading, error, reload, createPractitioner };
}
