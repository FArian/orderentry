import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSessionFromCookies } from "@/lib/auth";
import { glnApiBase } from "@/config";

type GlnRole = {
  TYPE?: string;
  STREET?: string;
  STRNO?: string;
  ZIP?: string;
  CITY?: string;
  CTN?: string;
  CNTRY?: string;
};

type GlnItem = {
  PTYPE?: string;
  GLN?: string;
  STATUS?: string;
  LANG?: string;
  DESCR1?: string;
  DESCR2?: string;
  ROLE?: GlnRole[];
};

type GlnResponse = {
  ITEM?: Record<string, GlnItem>;
  RESULT?: { OK_ERROR?: string; NBR_RECORD?: number };
};

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!glnApiBase) {
    return NextResponse.json({ error: "noGlnApi" }, { status: 503 });
  }

  const gln = req.nextUrl.searchParams.get("gln") || "";
  if (!/^\d{13}$/.test(gln)) {
    return NextResponse.json({ error: "invalidGln" }, { status: 400 });
  }

  // UUID: unique per request — used by Orchestra for audit/tracing
  const uuid = crypto.randomUUID();
  const url = `${glnApiBase}?GLN=${encodeURIComponent(gln)}&UUID=${encodeURIComponent(uuid)}`;

  try {
    const upstream = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const data = (await upstream.json()) as GlnResponse;

    if (data.RESULT?.OK_ERROR !== "OK" || !data.ITEM) {
      return NextResponse.json({ error: "glnNotFound" }, { status: 404 });
    }

    // ITEM keys are date strings — take the first (most recent) entry
    const entries = Object.values(data.ITEM);
    if (entries.length === 0) {
      return NextResponse.json({ error: "glnNotFound" }, { status: 404 });
    }

    const item = entries[0];
    const role = Array.isArray(item.ROLE) && item.ROLE.length > 0 ? item.ROLE[0] : undefined;

    return NextResponse.json({
      gln: item.GLN || gln,
      organization: item.DESCR1 || "",
      organization2: item.DESCR2 || "",
      street: role?.STREET || "",
      streetNo: role?.STRNO || "",
      zip: role?.ZIP || "",
      city: role?.CITY || "",
      canton: role?.CTN || "",
      country: role?.CNTRY || "",
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lookup failed" },
      { status: 500 }
    );
  }
}
