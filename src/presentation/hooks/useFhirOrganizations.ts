"use client";

import { useState, useEffect, useCallback } from "react";
import { useRefresh } from "@/lib/refresh";
import type { FhirBundle } from "@/infrastructure/fhir/FhirTypes";
import type {
  FhirOrganizationDto,
  CreateOrganizationRequestDto,
} from "@/infrastructure/api/dto/FhirRegistryDto";
import type { FhirOrganization } from "@/infrastructure/api/controllers/FhirOrganizationsController";

// Both systems are valid GS1 GLN URIs — check both for backward compatibility
const GLN_SYSTEMS = ["https://www.gs1.org/gln", "urn:oid:2.51.1.3"];

function extractGln(org: FhirOrganization): string {
  return org.identifier?.find((i) => i.system !== undefined && GLN_SYSTEMS.includes(i.system))?.value ?? "";
}

function orgToDto(
  org: FhirOrganization,
  nameById: Map<string, string>,
): FhirOrganizationDto {
  const parentRef = org.partOf?.reference ?? "";
  const parentId  = parentRef ? (parentRef.split("/").at(-1) ?? "") : "";
  return {
    id:   org.id ?? "",
    name: org.name ?? "",
    gln:  extractGln(org),
    ...(parentId ? { parentId, parentName: nameById.get(parentId) ?? parentId } : {}),
  };
}

function orgResourceToDto(org: FhirOrganization): FhirOrganizationDto {
  return {
    id:   org.id ?? "",
    name: org.name ?? "",
    gln:  extractGln(org),
  };
}

interface UseFhirOrganizationsResult {
  organizations: FhirOrganizationDto[];
  loading:       boolean;
  error:         string | null;
  reload:        () => void;
  createOrg:     (dto: CreateOrganizationRequestDto) => Promise<FhirOrganizationDto>;
  updateOrg:     (id: string, dto: { name: string; gln: string; parentId?: string }) => Promise<FhirOrganizationDto>;
  deleteOrg:     (id: string) => Promise<void>;
}

export function useFhirOrganizations(): UseFhirOrganizationsResult {
  const { refreshCount } = useRefresh();
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
      .then((bundle: FhirBundle<FhirOrganization>) => {
        if ((bundle as { resourceType?: string }).resourceType === "OperationOutcome") {
          const outcome = bundle as unknown as { issue?: Array<{ details?: { text?: string } }> };
          setError(outcome.issue?.[0]?.details?.text ?? "Fehler beim Laden");
          return;
        }
        const orgs = (bundle.entry ?? [])
          .map((e) => e.resource)
          .filter((r): r is FhirOrganization => !!r && !!r.id);

        const nameById = new Map(orgs.map((o) => [o.id!, o.name ?? ""]));
        setOrganizations(orgs.map((o) => orgToDto(o, nameById)));
      })
      .catch((e: unknown) => {
        if ((e as { name?: string }).name !== "AbortError") {
          setError(e instanceof Error ? e.message : "Load failed");
        }
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [rev, refreshCount]);

  const createOrg = useCallback(
    async (dto: CreateOrganizationRequestDto): Promise<FhirOrganizationDto> => {
      const res  = await fetch("/api/fhir/organizations", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify(dto),
      });
      const data = (await res.json()) as FhirOrganization & { issue?: unknown[] };
      if (!res.ok || data.issue) throw new Error(
        (data as { issue?: Array<{ details?: { text?: string } }> }).issue?.[0]?.details?.text
          ?? `HTTP ${res.status}`,
      );
      reload();
      return orgResourceToDto(data);
    },
    [reload],
  );

  const updateOrg = useCallback(
    async (id: string, dto: { name: string; gln: string; parentId?: string }): Promise<FhirOrganizationDto> => {
      const res  = await fetch(`/api/fhir/organizations/${id}`, {
        method:  "PUT",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify(dto),
      });
      const data = (await res.json()) as FhirOrganization & { issue?: unknown[] };
      if (!res.ok || data.issue) throw new Error(
        (data as { issue?: Array<{ details?: { text?: string } }> }).issue?.[0]?.details?.text
          ?? `HTTP ${res.status}`,
      );
      reload();
      return orgResourceToDto(data);
    },
    [reload],
  );

  const deleteOrg = useCallback(async (id: string): Promise<void> => {
    const res  = await fetch(`/api/fhir/organizations/${id}`, { method: "DELETE" });
    const data = (await res.json()) as { issue?: Array<{ severity?: string; details?: { text?: string } }> };
    const isError = !res.ok || data.issue?.some((i) => i.severity === "error" || i.severity === "fatal");
    if (isError) throw new Error(data.issue?.[0]?.details?.text ?? `HTTP ${res.status}`);
    reload();
  }, [reload]);

  return { organizations, loading, error, reload, createOrg, updateOrg, deleteOrg };
}
