/**
 * FHIR Proxy — catch-all route
 *
 * Forwards browser FHIR requests to the HAPI FHIR server configured via
 * ORDERENTRY_FHIR__BASE_URL (EnvConfig.fhirBaseUrl).
 *
 * This solves the problem of legacy client-side code (lib/fhir.ts) calling
 * FHIR directly from the browser: the browser always falls back to the default
 * FHIR_BASE (localhost:8080/fhir) because server ENV vars are not available in
 * the client bundle. By routing through this proxy, all FHIR calls go through
 * the server which has the correct URL.
 *
 * Specific routes (/api/fhir/organizations, /api/fhir/practitioners, …) take
 * priority over this catch-all — Next.js routing guarantees that.
 *
 * Auth: requires a valid session (user or admin). No unauthenticated access.
 */

import { type NextRequest, NextResponse } from "next/server";
import { EnvConfig } from "@/infrastructure/config/EnvConfig";
import { getSessionFromCookies } from "@/lib/auth";

export const dynamic = "force-dynamic";

const FHIR_CT = "application/fhir+json";

type Params = { path: string[] };

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const search = req.nextUrl.search ?? "";
  const target = `${EnvConfig.fhirBaseUrl}/${path.join("/")}${search}`;

  const headers: Record<string, string> = {
    accept: FHIR_CT,
  };
  const ct = req.headers.get("content-type");
  if (ct) headers["content-type"] = ct;

  let body: BodyInit | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.text();
  }

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    ...(body !== undefined && { body }),
    cache: "no-store",
  });

  const upstreamCt = upstream.headers.get("content-type") ?? FHIR_CT;
  const data = await upstream.text();

  return new NextResponse(data, {
    status: upstream.status,
    headers: { "content-type": upstreamCt },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  const { path } = await params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, { params }: { params: Promise<Params> }) {
  const { path } = await params;
  return proxy(req, path);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<Params> }) {
  const { path } = await params;
  return proxy(req, path);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<Params> }) {
  const { path } = await params;
  return proxy(req, path);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<Params> }) {
  const { path } = await params;
  return proxy(req, path);
}
