import { NextRequest, NextResponse } from "next/server";
import { apiGateway }               from "@/infrastructure/api/gateway/ApiGateway";
import { fhirGet }                  from "@/infrastructure/fhir/FhirClient";
import { EnvConfig }                from "@/infrastructure/config/EnvConfig";

export const dynamic = "force-dynamic";

// ── Simple in-process cache (reset on server restart) ─────────────────────────

let _cache: { types: string[]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── FHIR fetch ────────────────────────────────────────────────────────────────

interface FhirTopic {
  coding?: Array<{ system?: string; code?: string; display?: string }>;
  text?:   string;
}

interface FhirActivityDefinition {
  resourceType: string;
  topic?:       FhirTopic[];
}

interface FhirBundle {
  entry?: Array<{ resource?: FhirActivityDefinition }>;
}

async function fetchFromFhir(): Promise<string[]> {
  const categorySystem = EnvConfig.fhirSystems.category;

  const bundle = await fhirGet<FhirBundle>("/ActivityDefinition", {
    _elements: "topic",
    _count:    "1000",
  });

  const seen = new Set<string>();
  for (const entry of bundle.entry ?? []) {
    const res = entry.resource;
    if (!res || res.resourceType !== "ActivityDefinition") continue;
    for (const topic of res.topic ?? []) {
      for (const coding of topic.coding ?? []) {
        if (!coding.code) continue;
        // Accept: matching category system OR any coding when system is absent
        if (!coding.system || coding.system === categorySystem || coding.system.includes("zetlab")) {
          seen.add(coding.code);
        }
      }
    }
  }

  return [...seen].sort();
}

// ── Route ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/config/service-types
 *
 * Returns the active order service types in priority order:
 *   1. ORDER_SERVICE_TYPES env (explicit override)
 *   2. Distinct ActivityDefinition.topic codes from FHIR (cached 5 min)
 *   3. Built-in fallback: ["MIBI", "ROUTINE", "POC"]
 */
export async function GET(req: NextRequest) {
  return apiGateway.handle(
    req,
    { version: "v1", endpoint: "/config/service-types", auth: "admin" },
    async () => {
      // 1. ENV override
      const envOverride = process.env.ORDER_SERVICE_TYPES;
      if (envOverride) {
        const types = envOverride.split(",").map((s) => s.trim()).filter(Boolean);
        return NextResponse.json({ types, source: "env" });
      }

      // 2. In-process cache
      if (_cache && Date.now() < _cache.expiresAt) {
        return NextResponse.json({ types: _cache.types, source: "fhir-cached" });
      }

      // 3. Fetch from FHIR
      try {
        const types = await fetchFromFhir();
        const result = types.length > 0 ? types : ["MIBI", "ROUTINE", "POC"];
        _cache = { types: result, expiresAt: Date.now() + CACHE_TTL_MS };
        return NextResponse.json({ types: result, source: "fhir" });
      } catch {
        const fallback = ["MIBI", "ROUTINE", "POC"];
        return NextResponse.json({ types: fallback, source: "fallback" });
      }
    },
  );
}
