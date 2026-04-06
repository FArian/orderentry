"use client";

import { useState, useEffect, useCallback } from "react";
import { useRefresh } from "@/lib/refresh";
import type { FhirBundle } from "@/infrastructure/fhir/FhirTypes";
import type {
  FhirPractitionerDto,
  CreatePractitionerRequestDto,
  UpdatePractitionerRequestDto,
} from "@/infrastructure/api/dto/FhirRegistryDto";
import type {
  FhirPractitioner,
  FhirPractitionerRole,
} from "@/infrastructure/api/controllers/FhirPractitionersController";

// Both systems are valid GS1 GLN URIs — check both for backward compatibility
const GLN_SYSTEMS = ["https://www.gs1.org/gln", "urn:oid:2.51.1.3"];

type BundleResource = FhirPractitioner | FhirPractitionerRole | { resourceType: string; id?: string; name?: string };

function extractId(ref?: string): string {
  if (!ref) return "";
  const parts = ref.split("/");
  return parts[parts.length - 1] ?? "";
}

function extractGln(identifiers?: Array<{ system?: string; value?: string }>): string {
  return identifiers?.find((i) => i.system !== undefined && GLN_SYSTEMS.includes(i.system))?.value ?? "";
}

function bundleToDtos(bundle: FhirBundle<BundleResource>): FhirPractitionerDto[] {
  const orgsById   = new Map<string, { id: string; name: string }>();
  const practsById = new Map<string, FhirPractitioner>();
  const roles: FhirPractitionerRole[] = [];

  for (const entry of bundle.entry ?? []) {
    const r = entry.resource as Record<string, unknown> | undefined;
    if (!r) continue;
    if (r.resourceType === "Organization") {
      const org = r as { id?: string; name?: string };
      if (org.id) orgsById.set(org.id, { id: org.id, name: org.name ?? "" });
    } else if (r.resourceType === "Practitioner") {
      const p = r as FhirPractitioner;
      if (p.id) practsById.set(p.id, p);
    } else if (r.resourceType === "PractitionerRole") {
      roles.push(r as FhirPractitionerRole);
    }
  }

  const practitioners: FhirPractitionerDto[] = [];
  for (const role of roles) {
    const practId = extractId(role.practitioner?.reference);
    const orgId   = extractId(role.organization?.reference);
    const pract   = practsById.get(practId);
    const org     = orgsById.get(orgId);
    if (!pract || !role.id) continue;

    const humanName = pract.name?.[0];
    practitioners.push({
      id:                 pract.id ?? practId,
      firstName:          humanName?.given?.[0] ?? "",
      lastName:           humanName?.family ?? "",
      gln:                extractGln(pract.identifier),
      organizationId:     orgId,
      organizationName:   org?.name ?? orgId,
      roleCode:           role.code?.[0]?.coding?.[0]?.code ?? "",
      roleDisplay:        role.code?.[0]?.coding?.[0]?.display ?? role.code?.[0]?.text ?? "",
      practitionerRoleId: role.id,
    });
  }
  return practitioners;
}

interface UseFhirPractitionersResult {
  practitioners:      FhirPractitionerDto[];
  loading:            boolean;
  error:              string | null;
  reload:             () => void;
  createPractitioner: (dto: CreatePractitionerRequestDto) => Promise<FhirPractitionerDto>;
  updatePractitioner: (practitionerRoleId: string, dto: UpdatePractitionerRequestDto) => Promise<void>;
}

export function useFhirPractitioners(): UseFhirPractitionersResult {
  const { refreshCount } = useRefresh();
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
      .then((bundle: FhirBundle<BundleResource>) => {
        if ((bundle as { resourceType?: string }).resourceType === "OperationOutcome") {
          const outcome = bundle as unknown as { issue?: Array<{ details?: { text?: string } }> };
          setError(outcome.issue?.[0]?.details?.text ?? "Fehler beim Laden");
          return;
        }
        setPractitioners(bundleToDtos(bundle));
      })
      .catch((e: unknown) => {
        if ((e as { name?: string }).name !== "AbortError") {
          setError(e instanceof Error ? e.message : "Load failed");
        }
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [rev, refreshCount]);

  const createPractitioner = useCallback(
    async (dto: CreatePractitionerRequestDto): Promise<FhirPractitionerDto> => {
      const res  = await fetch("/api/fhir/practitioners", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify(dto),
      });
      const data = (await res.json()) as FhirPractitionerRole & { issue?: unknown[] };
      if (!res.ok || data.issue) throw new Error(
        (data as { issue?: Array<{ details?: { text?: string } }> }).issue?.[0]?.details?.text
          ?? `HTTP ${res.status}`,
      );
      reload();
      // The full DTO with names will be returned on the next list() call; return a partial placeholder
      return {
        id:                 "",
        firstName:          dto.firstName,
        lastName:           dto.lastName,
        gln:                dto.gln,
        organizationId:     dto.organizationId,
        organizationName:   "",
        roleCode:           dto.roleCode,
        roleDisplay:        "",
        practitionerRoleId: data.id ?? "",
      };
    },
    [reload],
  );

  const updatePractitioner = useCallback(
    async (practitionerRoleId: string, dto: UpdatePractitionerRequestDto): Promise<void> => {
      const res  = await fetch(`/api/fhir/practitioners/${practitionerRoleId}`, {
        method:  "PUT",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify(dto),
      });
      const data = (await res.json()) as { issue?: unknown[] };
      if (!res.ok || data.issue) throw new Error(
        (data as { issue?: Array<{ details?: { text?: string } }> }).issue?.[0]?.details?.text
          ?? `HTTP ${res.status}`,
      );
      reload();
    },
    [reload],
  );

  return { practitioners, loading, error, reload, createPractitioner, updatePractitioner };
}
