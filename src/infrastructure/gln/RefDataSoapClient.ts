import type { GlnLookupResult } from "@/domain/entities/GlnLookupResult";
import { parseRefDataXml }       from "./RefDataXmlParser";
import { mapToGlnLookupResult }  from "./RefDataToDomainMapper";
import { createLogger }           from "../logging/Logger";

const log = createLogger("RefDataSoapClient");

/** Thrown when the GLN is not found in the RefData registry (RESULT.OK_ERROR !== "OK"). */
export class GlnNotFoundError extends Error {
  constructor(gln: string) {
    super(`GLN not found: ${gln}`);
    this.name = "GlnNotFoundError";
  }
}

/** Thrown when the SOAP call fails (network, timeout, non-2xx, parse error). */
export class GlnLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GlnLookupError";
  }
}

function buildSoapEnvelope(gln: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:ref="http://refdatabase.refdata.ch/">
  <soap:Body>
    <ref:GLN_DETAIL>
      <ref:sGLN>${gln}</ref:sGLN>
      <ref:sLang>DE</ref:sLang>
    </ref:GLN_DETAIL>
  </soap:Body>
</soap:Envelope>`;
}

export class RefDataSoapClient {
  private readonly endpointUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(endpointUrl: string, timeoutMs = 5000, fetchFn: typeof fetch = fetch) {
    this.endpointUrl = endpointUrl;
    this.timeoutMs   = timeoutMs;
    this.fetchFn     = fetchFn;
  }

  /**
   * Look up a 13-digit GLN in the RefData partner registry.
   *
   * @throws {GlnNotFoundError} when the registry returns OK_ERROR !== "OK"
   * @throws {GlnLookupError}   on network error, timeout, or unexpected response
   */
  async lookup(gln: string): Promise<GlnLookupResult> {
    const envelope = buildSoapEnvelope(gln);

    log.debug("SOAP request", { gln, endpoint: this.endpointUrl });

    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchFn(this.endpointUrl, {
        method:  "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "SOAPAction":   "http://refdatabase.refdata.ch/GLN_DETAIL",
        },
        body:   envelope,
        signal: controller.signal,
        cache:  "no-store",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error("SOAP fetch failed", { gln, message });
      throw new GlnLookupError(`SOAP request failed: ${message}`);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      log.error("SOAP non-2xx response", { gln, status: response.status });
      throw new GlnLookupError(`SOAP server returned HTTP ${response.status}`);
    }

    const xml = await response.text().catch((err: unknown) => {
      throw new GlnLookupError(`Failed to read SOAP response: ${err instanceof Error ? err.message : String(err)}`);
    });

    log.debug("SOAP response received", { gln, bytes: xml.length });

    const item = parseRefDataXml(xml);

    if (item.okError !== "OK") {
      log.debug("GLN not found", { gln, okError: item.okError });
      throw new GlnNotFoundError(gln);
    }

    return mapToGlnLookupResult(item, gln);
  }
}
