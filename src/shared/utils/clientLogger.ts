/**
 * ClientLogger — structured browser console logging.
 *
 * Mirror of the server-side Logger but browser-safe: no `fs`, no process.env.
 * Log level is read from RuntimeConfig (localStorage) on every call so changes
 * made on the Settings page take effect immediately without a page reload.
 *
 * Output format (same as server Logger — one JSON line per message):
 *   {"time":"…","level":"info","ctx":"MyHook","msg":"…","extra":"value"}
 *
 * Usage:
 *   const log = createClientLogger("useResults");
 *   log.info("Results fetched", { count: 12 });
 *   log.error("Fetch failed", { status: 503 });
 */

import { RuntimeConfig, type ClientLogLevel } from "@/shared/config/RuntimeConfig";

const LEVEL_RANK: Record<ClientLogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

function emit(
  level: ClientLogLevel,
  ctx: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  // Level is re-read on every call so Settings-page changes apply instantly.
  const minLevel = RuntimeConfig.get().logLevel;
  if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) return;

  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    ctx,
    msg: message,
    ...meta,
  });

  switch (level) {
    case "debug":
      console.debug(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "error":
      console.error(line);
      break;
    default:
      console.log(line);
  }
}

export interface ClientLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Creates a ClientLogger scoped to the given context (hook or component name).
 * Safe to call during SSR — all calls are no-ops when `window` is absent.
 */
export function createClientLogger(ctx: string): ClientLogger {
  return {
    debug: (msg, meta) => emit("debug", ctx, msg, meta),
    info:  (msg, meta) => emit("info",  ctx, msg, meta),
    warn:  (msg, meta) => emit("warn",  ctx, msg, meta),
    error: (msg, meta) => emit("error", ctx, msg, meta),
  };
}
