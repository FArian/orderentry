"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  FhirOrganizationDto,
  CreateOrganizationRequestDto,
} from "@/infrastructure/api/dto/FhirRegistryDto";

interface UseFhirOrganizationsResult {
  organizations: FhirOrganizationDto[];
  loading:       boolean;
  error:         string | null;
  reload:        () => void;
  createOrg:     (dto: CreateOrganizationRequestDto) => Promise<FhirOrganizationDto>;
}

export function useFhirOrganizations(): UseFhirOrganizationsResult {
  const [organizations, setOrganizations] = useState<FhirOrganizationDto[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [rev,           setRev]           = useState(0);

  const reload = useCallback(() => setRev((r) => r + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);

    fetch("/api/fhir/organizations", { signal: ctrl.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((data: { organizations?: FhirOrganizationDto[]; error?: string }) => {
        if (data.error) setError(data.error);
        else setOrganizations(data.organizations ?? []);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string }).name !== "AbortError") {
          setError(e instanceof Error ? e.message : "Load failed");
        }
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [rev]);

  const createOrg = useCallback(async (dto: CreateOrganizationRequestDto): Promise<FhirOrganizationDto> => {
    const res = await fetch("/api/fhir/organizations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(dto),
    });
    const data = (await res.json()) as FhirOrganizationDto & { error?: string };
    if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
    reload();
    return data;
  }, [reload]);

  return { organizations, loading, error, reload, createOrg };
}
