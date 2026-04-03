/**
 * GET /api/metrics — Prometheus text exposition endpoint.
 *
 * Authentication (checked in order):
 *   1. METRICS_TOKEN env var is set → requires  Authorization: Bearer <token>
 *   2. Otherwise                    → requires admin session or Bearer JWT/PAT
 *
 * Prometheus scrape_config example:
 *   - job_name: zetlab
 *     static_configs:
 *       - targets: ['orderentry:3000']
 *     metrics_path: /api/metrics
 *     bearer_token: <METRICS_TOKEN>
 */

import { prometheusService } from "@/infrastructure/metrics/PrometheusService";
import { checkAdminAccess } from "@/lib/auth";
import { EnvConfig } from "@/infrastructure/config/EnvConfig";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const unauthorized = new Response("Unauthorized", {
    status: 401,
    headers: { "www-authenticate": 'Bearer realm="zetlab metrics"' },
  });

  const metricsToken = EnvConfig.metricsToken;

  if (metricsToken) {
    // Dedicated scrape token — fast path, no user-store lookup needed.
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${metricsToken}`) return unauthorized;
  } else {
    // Fall back to standard admin access (session cookie or JWT/PAT bearer).
    const access = await checkAdminAccess(req);
    if (!access.authorized) return unauthorized;
  }

  const body = await prometheusService.metrics();
  return new Response(body, {
    status: 200,
    headers: { "content-type": prometheusService.contentType },
  });
}
