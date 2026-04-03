/**
 * Shared minimal FHIR R4 types used across the infrastructure layer.
 *
 * These cover only the structures we actually produce or consume.
 * FHIR field names must not appear outside `infrastructure/` — keep all
 * mapping logic here or in the mapper classes.
 */

// ── Bundle ─────────────────────────────────────────────────────────────────────

export interface FhirBundle<T = unknown> {
  resourceType: "Bundle";
  id?:          string;
  type:         "searchset" | "transaction" | "transaction-response" | "collection";
  total?:       number;
  link?:        FhirBundleLink[];
  entry?:       FhirBundleEntry<T>[];
}

export interface FhirBundleLink {
  relation: string;
  url:      string;
}

export interface FhirBundleEntry<T = unknown> {
  fullUrl?:  string;
  resource?: T;
  search?:   { mode?: "match" | "include"; score?: number };
  request?:  { method: string; url: string };
}

// ── OperationOutcome ───────────────────────────────────────────────────────────

export interface FhirOperationOutcome {
  resourceType: "OperationOutcome";
  issue:        FhirIssue[];
  /** Internal field — stripped before sending JSON response body. */
  httpStatus?:  number;
}

export interface FhirIssue {
  severity:     "fatal" | "error" | "warning" | "information";
  code:         string;
  details?:     { text?: string };
  diagnostics?: string;
}

// ── Builder helpers ────────────────────────────────────────────────────────────

/** Build a FHIR OperationOutcome (error or info) with an optional httpStatus hint. */
export function buildOperationOutcome(
  severity: FhirIssue["severity"],
  code: string,
  detail: string,
  httpStatus?: number,
): FhirOperationOutcome {
  return {
    resourceType: "OperationOutcome",
    issue: [{ severity, code, details: { text: detail } }],
    ...(httpStatus !== undefined ? { httpStatus } : {}),
  };
}

/** Build a FHIR searchset Bundle from an array of resources with optional pagination links. */
export function buildSearchBundle<T extends object>(
  resources: T[],
  total: number,
  links?: FhirBundleLink[],
): FhirBundle<T> {
  return {
    resourceType: "Bundle",
    type: "searchset",
    total,
    ...(links && links.length > 0 ? { link: links } : {}),
    entry: resources.map((resource) => ({ resource })),
  };
}

/** Build pagination links for a searchset Bundle. */
export function buildPaginationLinks(
  selfPath: string,
  page: number,
  pageSize: number,
  total: number,
): FhirBundleLink[] {
  const links: FhirBundleLink[] = [
    { relation: "self", url: `${selfPath}?page=${page}&pageSize=${pageSize}` },
  ];
  if (page > 1) {
    links.push({ relation: "previous", url: `${selfPath}?page=${page - 1}&pageSize=${pageSize}` });
  }
  if (page * pageSize < total) {
    links.push({ relation: "next", url: `${selfPath}?page=${page + 1}&pageSize=${pageSize}` });
  }
  return links;
}

/** Extract page and pageSize from the self link of a Bundle. */
export function extractPaginationFromBundle(
  bundle: FhirBundle,
  defaults: { page: number; pageSize: number },
): { page: number; pageSize: number } {
  const selfLink = bundle.link?.find((l) => l.relation === "self");
  if (!selfLink) return defaults;
  try {
    const u = new URL(selfLink.url, "http://x");
    const page     = parseInt(u.searchParams.get("page")     ?? String(defaults.page),     10);
    const pageSize = parseInt(u.searchParams.get("pageSize") ?? String(defaults.pageSize), 10);
    return { page: isNaN(page) ? defaults.page : page, pageSize: isNaN(pageSize) ? defaults.pageSize : pageSize };
  } catch {
    return defaults;
  }
}
