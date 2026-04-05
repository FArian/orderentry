import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies }     from "@/lib/auth";
import { EnvConfig }                 from "@/infrastructure/config/EnvConfig";
import { RefDataSoapClient, GlnNotFoundError, GlnLookupError } from "@/infrastructure/gln/RefDataSoapClient";
import { createLogger }              from "@/infrastructure/logging/Logger";

const log = createLogger("gln-lookup");

/**
 * GET /api/gln-lookup?gln={13-digit-gln}
 *
 * Looks up a GLN in the RefData partner registry via SOAP.
 * Replaces the former Orchestra REST/JSON middleware integration.
 *
 * Response: GlnLookupResult (see domain/entities/GlnLookupResult.ts)
 * Errors:   { error: "noGlnApi" | "invalidGln" | "glnNotFound" | string }
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gln = (req.nextUrl.searchParams.get("gln") ?? "").trim().replace(/\D/g, "");
  if (gln.length !== 13) {
    return NextResponse.json({ error: "invalidGln" }, { status: 400 });
  }

  const endpointUrl = EnvConfig.refdataSoapUrl;
  if (!endpointUrl) {
    return NextResponse.json({ error: "noGlnApi" }, { status: 503 });
  }

  log.debug("GLN lookup via RefData SOAP", { gln });

  const client = new RefDataSoapClient(endpointUrl);

  try {
    const result = await client.lookup(gln);
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof GlnNotFoundError) {
      return NextResponse.json({ error: "glnNotFound" }, { status: 404 });
    }
    if (err instanceof GlnLookupError) {
      log.error("GLN lookup failed", { gln, message: err.message });
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    const message = err instanceof Error ? err.message : "Lookup failed";
    log.error("unexpected error in GLN lookup", { gln, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
