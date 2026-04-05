/**
 * Hl7ProxyController — pure HTTP proxy between the Edge agent and Orchestra.
 *
 * Architecture rule (CRITICAL):
 *   OrderEntry does NOT parse HL7.
 *   OrderEntry does NOT convert HL7 ↔ FHIR.
 *   Orchestra is the integration engine responsible for all HL7 processing.
 *
 * This controller only:
 *   1. Validates that the Orchestra HL7 endpoint is configured.
 *   2. Forwards the raw request body to Orchestra.
 *   3. Returns the Orchestra response (or a structured error).
 *
 * Inbound:  Agent → POST /api/v1/proxy/hl7/inbound → Orchestra (HL7 → FHIR)
 * Outbound: Agent → GET  /api/v1/proxy/hl7/outbound → Orchestra (FHIR → HL7)
 */

import { EnvConfig } from "@/infrastructure/config/EnvConfig";
import { createLogger } from "@/infrastructure/logging/Logger";

const log = createLogger("Hl7ProxyController");

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Hl7InboundResult {
  accepted:   boolean;
  messageId?: string;
  detail?:    string;
  httpStatus: number;
}

export interface Hl7OutboundResult {
  messages:   Hl7Message[];
  total:      number;
  httpStatus: number;
}

export interface Hl7Message {
  id:          string;
  type:        string;         // e.g. "ORU_R01", "ADT_A01"
  contentType: string;         // e.g. "text/plain", "application/hl7-v2"
  body:        string;         // raw HL7 message
  createdAt:   string;         // ISO 8601
}

export interface Hl7ProxyError {
  error:      string;
  detail?:    string;
  httpStatus: number;
}

export type Hl7InboundResponse  = Hl7InboundResult  | Hl7ProxyError;
export type Hl7OutboundResponse = Hl7OutboundResult | Hl7ProxyError;

// ── Helpers ───────────────────────────────────────────────────────────────────

function notConfigured(): Hl7ProxyError {
  return {
    error:      "Orchestra HL7 endpoint not configured",
    detail:     "Set ORCHESTRA_HL7_BASE in your environment to enable HL7 proxying.",
    httpStatus: 503,
  };
}

function buildUrl(base: string, path: string, params?: Record<string, string>): string {
  const url = new URL(path, base);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

// ── Controller ────────────────────────────────────────────────────────────────

export class Hl7ProxyController {
  /**
   * POST /api/v1/proxy/hl7/inbound
   *
   * Accepts a raw HL7v2 message (or batch) from the Edge agent and forwards it
   * to Orchestra. Orchestra converts HL7 → FHIR and stores the result.
   *
   * Content-Type of the body is passed through as-is to Orchestra.
   */
  async inbound(body: string, contentType: string): Promise<Hl7InboundResponse> {
    const base = EnvConfig.orchestraHl7Base;
    if (!base) return notConfigured();

    const url = buildUrl(base, EnvConfig.orchestraHl7InboundPath);

    try {
      const res = await fetch(url, {
        method:  "POST",
        headers: { "content-type": contentType || "text/plain; charset=utf-8" },
        body,
        cache:   "no-store",
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return { error: `Orchestra error: ${res.status}`, detail: detail.slice(0, 500), httpStatus: res.status };
      }

      const json = await res.json().catch(() => ({})) as Record<string, unknown>;
      return {
        accepted:   true,
        messageId:  String(json["messageId"] ?? json["id"] ?? ""),
        detail:     String(json["detail"] ?? json["message"] ?? "accepted"),
        httpStatus: 202,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error("inbound proxy failed", { url, message: msg });
      return { error: "Orchestra unreachable", detail: msg, httpStatus: 502 };
    }
  }

  /**
   * GET /api/v1/proxy/hl7/outbound
   *
   * Retrieves outbound HL7 messages (e.g. ORU results) from Orchestra.
   * Orchestra converts FHIR DiagnosticReport → HL7 ORU before returning.
   *
   * Query params forwarded to Orchestra:
   *   since  — ISO 8601 timestamp (incremental polling)
   *   format — HL7 message type filter (e.g. "ORU", "ADT")
   *   limit  — max number of messages (default: 100)
   */
  async outbound(params: {
    since?:  string;
    format?: string;
    limit?:  string;
  }): Promise<Hl7OutboundResponse> {
    const base = EnvConfig.orchestraHl7Base;
    if (!base) return notConfigured();

    const url = buildUrl(base, EnvConfig.orchestraHl7OutboundPath, {
      ...(params.since  && { since:  params.since }),
      ...(params.format && { format: params.format }),
      ...(params.limit  && { limit:  params.limit }),
    });

    try {
      const res = await fetch(url, {
        headers: { accept: "application/json" },
        cache:   "no-store",
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return { error: `Orchestra error: ${res.status}`, detail: detail.slice(0, 500), httpStatus: res.status };
      }

      const json = await res.json().catch(() => ({ messages: [], total: 0 })) as {
        messages?: Hl7Message[];
        total?:    number;
      };

      return {
        messages:  json.messages ?? [],
        total:     json.total    ?? (json.messages?.length ?? 0),
        httpStatus: 200,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error("outbound proxy failed", { url, message: msg });
      return { error: "Orchestra unreachable", detail: msg, httpStatus: 502 };
    }
  }
}

export const hl7ProxyController = new Hl7ProxyController();
