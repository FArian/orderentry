import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies }     from "@/lib/auth";
import { EnvConfig }                 from "@/infrastructure/config/EnvConfig";
import { GlnLookupController }       from "@/infrastructure/api/controllers/GlnLookupController";
import { glnAdapterV2 }              from "@/application/adapters/GlnAdapterV2";

/**
 * GET /api/v2/gln-lookup?gln={13-digit-gln}
 *
 * v2 response shape — nested structure with renamed fields.
 * Breaking changes from v1: ptype→partnerType, roleType→role,
 * flat fields → nested person{} / address{}, computed displayName.
 *
 * Same business logic as v1 via shared GlnLookupController.
 * Adapter pattern isolates the structural differences.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const endpointUrl = EnvConfig.refdataSoapUrl;
  if (!endpointUrl) {
    return NextResponse.json({ error: "noGlnApi" }, { status: 503 });
  }

  const gln = (req.nextUrl.searchParams.get("gln") ?? "").trim().replace(/\D/g, "");

  const controller = new GlnLookupController(endpointUrl);
  const result     = await controller.lookup(gln, "v2", glnAdapterV2);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
