import { NextRequest, NextResponse } from "next/server";
import { requirePermission }         from "@/infrastructure/api/middleware/RequirePermission";
import { PERMISSIONS }               from "@/domain/valueObjects/Permission";
import { EnvConfig }                 from "@/infrastructure/config/EnvConfig";
import { GlnLookupController }       from "@/infrastructure/api/controllers/GlnLookupController";
import { glnAdapterV1 }              from "@/application/adapters/GlnAdapterV1";

/**
 * GET /api/gln-lookup?gln={13-digit-gln}
 *
 * Legacy unversioned path — returns v1 response shape.
 * Stable versioned alias: GET /api/v1/gln-lookup (re-export, identical handler).
 */
export async function GET(req: NextRequest) {
  const perm = await requirePermission(req, PERMISSIONS.GLN_READ);
  if (!perm.ok) return perm.response;

  const endpointUrl = EnvConfig.refdataSoapUrl;
  if (!endpointUrl) {
    return NextResponse.json({ error: "noGlnApi" }, { status: 503 });
  }

  const gln = (req.nextUrl.searchParams.get("gln") ?? "").trim().replace(/\D/g, "");

  const controller = new GlnLookupController(endpointUrl);
  const result     = await controller.lookup(gln, "v1", glnAdapterV1);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
