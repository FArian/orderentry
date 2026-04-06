/**
 * DeepLinkService — orchestrates the full deep-link request lifecycle.
 *
 * Flow:
 *   1. Check DEEPLINK_ENABLED gate.
 *   2. Delegate token validation to the auth strategy.
 *   3. Verify the FHIR Patient exists.
 *   4. Emit an audit log event.
 *   5. Return a redirect URL for the order-entry workflow.
 *
 * This service is the only place that ties together auth, FHIR verification,
 * audit, and URL construction. The route handler stays thin.
 */

import { deepLinkAuthStrategy } from "./DeepLinkAuthStrategyFactory";
import { auditDeepLink }        from "./DeepLinkAuditLogger";
import { fhirGet }              from "../fhir/FhirClient";
import type { DeepLinkContext } from "@/domain/entities/DeepLinkContext";

// ── Result types ──────────────────────────────────────────────────────────────

export type DeepLinkResult =
  | { readonly ok: true;  readonly redirectUrl: string }
  | { readonly ok: false; readonly httpStatus: 400 | 401 | 403 | 404 | 503; readonly reason: string; readonly code: string };

interface RequestMeta {
  token:      string;
  url:        string;
  sourceIp?:  string | undefined;
  userAgent?: string | undefined;
}

// ── FHIR patient verification ─────────────────────────────────────────────────

async function verifyFhirPatient(patientId: string): Promise<boolean> {
  const bare = patientId.replace(/^Patient\//, "");
  try {
    const res = await fhirGet<{ resourceType: string }>(`/Patient/${bare}`);
    return res.resourceType === "Patient";
  } catch {
    return false;
  }
}

// ── Redirect URL builder ──────────────────────────────────────────────────────

function buildRedirectUrl(ctx: DeepLinkContext): string {
  const params = new URLSearchParams();
  params.set("patientId", ctx.patientId);
  if (ctx.encounterId) params.set("encounterId", ctx.encounterId);
  if (ctx.coverageId)  params.set("coverageId",  ctx.coverageId);
  params.set("source", ctx.sourceSystem);

  const path = ctx.contextType === "results"  ? "/results"
             : ctx.contextType === "patient"  ? `/patient/${ctx.patientId.replace(/^Patient\//, "")}`
             : "/order/new";

  return `${path}?${params.toString()}`;
}

// ── Service ───────────────────────────────────────────────────────────────────

export async function processDeepLink(meta: RequestMeta): Promise<DeepLinkResult> {
  if (!process.env.DEEPLINK_ENABLED || process.env.DEEPLINK_ENABLED !== "true") {
    auditDeepLink({ outcome: "disabled", sourceIp: meta.sourceIp });
    return { ok: false, httpStatus: 403, reason: "Deep linking is not enabled", code: "DISABLED" };
  }

  if (!meta.token) {
    auditDeepLink({ outcome: "auth_failure", sourceIp: meta.sourceIp, authError: { code: "MISSING_TOKEN", message: "No token provided" } });
    return { ok: false, httpStatus: 400, reason: "Missing token parameter", code: "MISSING_TOKEN" };
  }

  const authResult = await deepLinkAuthStrategy.validate(meta.token, meta.url);

  if (!authResult.ok) {
    auditDeepLink({
      outcome:   "auth_failure",
      sourceIp:  meta.sourceIp,
      userAgent: meta.userAgent,
      authError: authResult.error,
    });
    const status = authResult.error.code === "MISSING_TOKEN"   ? 400
                 : authResult.error.code === "EXPIRED_TOKEN"   ? 401
                 : authResult.error.code === "REPLAY_ATTACK"   ? 401
                 : authResult.error.code === "UNKNOWN_SYSTEM"  ? 403
                 : 401;
    return { ok: false, httpStatus: status, reason: authResult.error.message, code: authResult.error.code };
  }

  const context: DeepLinkContext = authResult.context;

  const exists = await verifyFhirPatient(context.patientId);
  if (!exists) {
    auditDeepLink({ outcome: "fhir_error", sourceIp: meta.sourceIp, detail: `Patient not found: ${context.patientId}` });
    return { ok: false, httpStatus: 404, reason: "Patient not found in FHIR server", code: "PATIENT_NOT_FOUND" };
  }

  auditDeepLink({
    outcome:   "success",
    sourceIp:  meta.sourceIp,
    userAgent: meta.userAgent,
    context,
  });

  return { ok: true, redirectUrl: buildRedirectUrl(context) };
}
