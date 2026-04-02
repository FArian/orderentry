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
  ROLE?: GlnRole | GlnRole[]; // API returns object OR array depending on version
};

type GlnResponse = {
  // API may return ITEM as a direct GlnItem OR as Record<string, GlnItem> (date-keyed)
  ITEM?: GlnItem | Record<string, GlnItem>;
  RESULT?: { OK_ERROR?: string; NBR_RECORD?: number | string };
};

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!glnApiBase) {
    return NextResponse.json({ error: "noGlnApi" }, { status: 503 });
  }

  const gln = req.nextUrl.searchParams.get("gln") || "";

  if (!/^\d{13}$/.test(gln)) {
    return NextResponse.json({ error: "invalidGln" }, { status: 400 });
  }

  const uuid = crypto.randomUUID();

  // ✅ Robust URL construction
  let url: string;
  try {
    const urlObj = new URL(glnApiBase);
    urlObj.searchParams.set("GLN", gln);
    urlObj.searchParams.set("UUID", uuid);
    url = urlObj.toString();
  } catch (err) {
    console.error("[gln-lookup] invalid glnApiBase:", glnApiBase);
    return NextResponse.json({ error: "invalidGlnApiBase" }, { status: 500 });
  }

  console.log("[gln-lookup] base:", glnApiBase);
  console.log("[gln-lookup] FINAL URL:", url);

  try {
    let upstream: Response;

    try {
      upstream = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
    } catch (fetchErr: unknown) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.error("[gln-lookup] fetch() failed:", msg);
      return NextResponse.json({ error: `fetch failed: ${msg}` }, { status: 502 });
    }

    console.log("[gln-lookup] HTTP status:", upstream.status);
    console.log("[gln-lookup] content-type:", upstream.headers.get("content-type"));

    // ✅ Clone wichtig, damit Stream nicht verloren geht
    const clone = upstream.clone();

    const rawText = await clone.text().catch(() => "");
    console.log("[gln-lookup] raw length:", rawText.length);
    console.log("[gln-lookup] raw body:", rawText.slice(0, 500));

    if (!rawText) {
      console.error("[gln-lookup] empty response from upstream");
      return NextResponse.json(
        { error: `Empty response (status ${upstream.status})` },
        { status: 502 }
      );
    }

    let data: GlnResponse;

    try {
      data = JSON.parse(rawText) as GlnResponse;
    } catch {
      console.error("[gln-lookup] JSON parse failed");
      return NextResponse.json(
        { error: `Invalid JSON (status ${upstream.status})` },
        { status: 502 }
      );
    }

    if (data.RESULT?.OK_ERROR !== "OK" || !data.ITEM) {
      return NextResponse.json({ error: "glnNotFound" }, { status: 404 });
    }

    // ITEM can be the GlnItem directly, or a Record<dateString, GlnItem>
    // Detect by checking if it has a known GlnItem field (PTYPE, GLN, DESCR1)
    let item: GlnItem;
    const rawItem = data.ITEM as Record<string, unknown>;
    if (rawItem.PTYPE !== undefined || rawItem.GLN !== undefined || rawItem.DESCR1 !== undefined) {
      // ITEM is the GlnItem itself
      item = rawItem as unknown as GlnItem;
    } else {
      // ITEM is Record<dateString, GlnItem> — take first value
      const entries = Object.values(rawItem) as GlnItem[];
      if (entries.length === 0) {
        return NextResponse.json({ error: "glnNotFound" }, { status: 404 });
      }
      item = entries[0]!;
    }

    // ROLE can be an object or an array
    const role: GlnRole | undefined = Array.isArray(item.ROLE)
      ? (item.ROLE.length > 0 ? item.ROLE[0] : undefined)
      : (item.ROLE ?? undefined);

    const isNAT = item.PTYPE === "NAT";

    return NextResponse.json({
      gln:          item.GLN   || gln,
      ptype:        item.PTYPE || "",
      roleType:     role?.TYPE || "",
      // NAT (natural person): DESCR1 = family name, DESCR2 = given name
      // JUR / others (organisation): DESCR1 = org name
      organization: isNAT ? "" : (item.DESCR1 || ""),
      lastName:     isNAT ? (item.DESCR1 || "") : "",
      firstName:    isNAT ? (item.DESCR2 || "") : "",
      street:       role?.STREET || "",
      streetNo:     role?.STRNO  || "",
      zip:          role?.ZIP    || "",
      city:         role?.CITY   || "",
      canton:       role?.CTN    || "",
      country:      role?.CNTRY  || "",
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lookup failed" },
      { status: 500 }
    );
  }
}