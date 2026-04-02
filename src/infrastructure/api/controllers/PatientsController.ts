/**
 * PatientsController — handles GET /api/patients.
 */

import { FHIR_BASE } from "@/infrastructure/fhir/FhirClient";
import { createLogger, type Logger } from "@/infrastructure/logging/Logger";
import type {
  ListPatientsQueryDto,
  PagedPatientsResponseDto,
  PatientResponseDto,
} from "../dto/PatientDto";

// ── Minimal FHIR types ────────────────────────────────────────────────────────
interface FhirHumanName {
  use?: string;
  text?: string;
  given?: string[];
  family?: string;
}
interface FhirAddress {
  use?: string;
  text?: string;
  line?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}
interface FhirPatient {
  resourceType: "Patient";
  id?: string;
  name?: FhirHumanName[];
  address?: FhirAddress[];
  meta?: { lastUpdated?: string };
}
interface FhirBundle<T = unknown> {
  resourceType: "Bundle";
  total?: number;
  entry?: Array<{ resource?: T }>;
}
// ─────────────────────────────────────────────────────────────────────────────

function nameToString(n?: FhirHumanName[]): string {
  if (!n || n.length === 0) return "Unknown";
  const first = n[0];
  if (!first) return "Unknown";
  if (first.text?.trim()) return first.text.trim();
  return [...(first.given ?? []), first.family ?? ""]
    .filter(Boolean)
    .join(" ") || "Unknown";
}

function addressToString(a?: FhirAddress[]): string {
  if (!a || a.length === 0) return "";
  const first = a[0];
  if (!first) return "";
  if (first.text?.trim()) return first.text.trim();
  return [
    ...(first.line ?? []),
    first.city,
    first.state,
    first.postalCode,
    first.country,
  ]
    .filter(Boolean)
    .join(", ");
}

export class PatientsController {
  private readonly log: Logger;

  constructor(
    private readonly fhirBase: string = FHIR_BASE,
    private readonly fetchFn: typeof globalThis.fetch = globalThis.fetch,
    logger?: Logger,
  ) {
    this.log = logger ?? createLogger("PatientsController");
  }

  async list(query: ListPatientsQueryDto): Promise<PagedPatientsResponseDto> {
    const {
      q = "",
      page = 1,
      pageSize = 10,
      showInactive = false,
    } = query;

    const safePage = Math.max(1, page);
    const safePageSize = Math.max(1, pageSize);
    const offset = (safePage - 1) * safePageSize;

    const activeValue = showInactive ? "false" : "true";

    const url = new URL(`${this.fhirBase}/Patient`);
    if (q) url.searchParams.set("name", q);
    url.searchParams.set("active", activeValue);
    url.searchParams.set("_count", String(safePageSize));
    url.searchParams.set("_getpagesoffset", String(offset));
    url.searchParams.set("_sort", "-_lastUpdated");

    const countUrl = new URL(`${this.fhirBase}/Patient`);
    if (q) countUrl.searchParams.set("name", q);
    countUrl.searchParams.set("active", activeValue);
    countUrl.searchParams.set("_summary", "count");
    countUrl.searchParams.set("_total", "accurate");

    this.log.debug("list Patients", { q, showInactive, page: safePage, pageSize: safePageSize });

    try {
      const [res, countRes] = await Promise.all([
        this.fetchFn(url.toString(), {
          headers: { accept: "application/fhir+json" },
          cache: "no-store",
        }),
        this.fetchFn(countUrl.toString(), {
          headers: { accept: "application/fhir+json" },
          cache: "no-store",
        }),
      ]);

      if (!res.ok) {
        this.log.error("FHIR Patient list failed", { status: res.status });
        return {
          data: [],
          total: 0,
          page: safePage,
          pageSize: safePageSize,
          error: `FHIR error: ${res.status}`,
          httpStatus: res.status,
        };
      }

      const bundle = (await res.json()) as FhirBundle<FhirPatient>;
      let total = bundle.total ?? 0;
      if (countRes.ok) {
        const countBundle = (await countRes.json()) as FhirBundle;
        total = countBundle.total ?? total;
      }

      const data: PatientResponseDto[] = (bundle.entry ?? [])
        .map((e) => e.resource)
        .filter(
          (r): r is FhirPatient => !!r && r.resourceType === "Patient" && !!r.id,
        )
        .map((p) => ({
          id: p.id as string,
          name: nameToString(p.name),
          address: addressToString(p.address),
          createdAt: p.meta?.lastUpdated ?? "",
        }));

      this.log.info("Patients fetched", { count: data.length, total });
      return { data, total, page: safePage, pageSize: safePageSize };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error("Patient list threw", { message });
      return {
        data: [],
        total: 0,
        page: safePage,
        pageSize: safePageSize,
        error: message || "Network error",
        httpStatus: 500,
      };
    }
  }
}

/** Production singleton — routes import this directly. */
export const patientsController = new PatientsController();
