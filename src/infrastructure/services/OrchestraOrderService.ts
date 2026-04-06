/**
 * OrchestraOrderService — requests order numbers from Orchestra/LIS.
 *
 * ⚠️  STUB — Orchestra API endpoint not yet built.
 *     Returns null (fallback to pool) until Orchestra implements:
 *     POST {ORCHESTRA_ORDER_API_URL}
 *     Body:    { orgGln, serviceType }
 *     Response:{ counter, serviceType }
 *
 * TODO: Remove stub behaviour once Orchestra API is ready.
 *       See Documentation/OrderNumberEngine.md — section "Orchestra Integration".
 */

import type { IOrchestraOrderService, OrchestraOrderNumberResult } from "@/application/interfaces/services/IOrchestraOrderService";
import type { ServiceType }  from "@/domain/strategies/IOrderNumberStrategy";
import { createLogger }      from "../logging/Logger";
import { EnvConfig }         from "../config/EnvConfig";

const log = createLogger("OrchestraOrderService");

export class OrchestraOrderService implements IOrchestraOrderService {
  constructor(
    private readonly apiUrl:     string = EnvConfig.orchestraOrderApiUrl,
    private readonly timeoutMs:  number = EnvConfig.orchestraOrderTimeoutMs,
    private readonly fetchFn:    typeof globalThis.fetch = globalThis.fetch,
  ) {}

  async requestNumber(
    orgGln:      string,
    serviceType: ServiceType,
  ): Promise<OrchestraOrderNumberResult | null> {
    // Stub: no URL configured → always fall back to pool
    if (!this.apiUrl) {
      log.debug("OrchestraOrderService: no API URL configured, using pool fallback");
      return null;
    }

    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchFn(this.apiUrl, {
        method:  "POST",
        headers: { "content-type": "application/json", "accept": "application/json" },
        body:    JSON.stringify({ orgGln, serviceType }),
        signal:  controller.signal,
      });

      if (!res.ok) {
        log.warn("Orchestra order number request failed", { status: res.status });
        return null;
      }

      const data = (await res.json()) as { counter?: number; serviceType?: string };
      if (typeof data.counter !== "number") {
        log.warn("Orchestra response missing counter field");
        return null;
      }

      log.info("Orchestra order number received", { counter: data.counter, serviceType });
      return { counter: data.counter, serviceType };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.warn("Orchestra order number request threw", { message });
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const orchestraOrderService = new OrchestraOrderService();
