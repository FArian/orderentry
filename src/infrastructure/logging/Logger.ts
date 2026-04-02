/**
 * Logger — centralized structured logging for the infrastructure layer.
 *
 * Usage:
 *   const log = createLogger("ResultsController");
 *   log.info("Fetching DiagnosticReports", { patientId: "p-123" });
 *   log.error("FHIR request failed", { status: 503 });
 *
 * Configuration (via EnvConfig / environment variables):
 *   LOG_LEVEL = debug | info | warn | error | silent   (default: info)
 *   LOG_FILE  = /var/log/zetlab.log                    (default: none)
 *
 * Log levels are ordered: debug < info < warn < error < silent.
 * A message is emitted only when its level >= the configured level.
 *
 * Output format (JSON, one object per line):
 *   {"time":"2024-03-01T12:00:00.000Z","level":"info","ctx":"ResultsController","msg":"...","patientId":"p-123"}
 *
 * File logging is optional. When LOG_FILE is set the same JSON line is
 * appended to the file in addition to stdout/stderr. File I/O uses the
 * synchronous Node.js fs API so it is safe inside Next.js API routes
 * (no async overhead, no lost lines on crash).
 */

import fs from "fs";
import path from "path";

// ── Log level ordering ────────────────────────────────────────────────────────

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

function parseLevel(raw: string): LogLevel {
  const v = raw.toLowerCase().trim() as LogLevel;
  return v in LEVEL_RANK ? v : "info";
}

// ── Singleton config (read once at module load) ───────────────────────────────

const _configuredLevel: LogLevel = parseLevel(
  process.env.LOG_LEVEL ?? "info",
);
const _logFile: string | null = process.env.LOG_FILE?.trim() || null;

/**
 * Tracing integration point (ENABLE_TRACING=true).
 *
 * When tracing is enabled, a traceId should be injected per-request using
 * AsyncLocalStorage or an OpenTelemetry context manager. For now the value
 * can be supplied explicitly via Logger.withTraceId() or the `meta` parameter.
 *
 * Wire to opentelemetry-sdk-node when ready:
 *   import { trace } from "@opentelemetry/api";
 *   const traceId = trace.getActiveSpan()?.spanContext().traceId;
 */
const _tracingEnabled: boolean =
  (process.env.ENABLE_TRACING ?? "").trim().toLowerCase() === "true";

// ── Formatter ─────────────────────────────────────────────────────────────────

function format(
  level: LogLevel,
  ctx: string,
  message: string,
  meta?: Record<string, unknown>,
  traceId?: string,
): string {
  const entry: Record<string, unknown> = {
    time: new Date().toISOString(),
    level,
    ctx,
    msg: message,
    // Include traceId when tracing is enabled and a value is available.
    // Future: replace with opentelemetry context propagation.
    ...(_tracingEnabled && traceId ? { traceId } : {}),
    ...meta,
  };
  return JSON.stringify(entry);
}

// ── File appender (optional) ──────────────────────────────────────────────────

function appendToFile(line: string): void {
  if (!_logFile) return;
  try {
    const dir = path.dirname(_logFile);
    if (dir && dir !== ".") fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(_logFile, line + "\n", "utf8");
  } catch {
    // Swallow file errors — console logging must not be interrupted
  }
}

// ── Logger class ──────────────────────────────────────────────────────────────

export class Logger {
  private readonly ctx: string;
  private readonly minRank: number;
  private readonly traceId: string | undefined;

  constructor(ctx: string, level: LogLevel = _configuredLevel, traceId?: string) {
    this.ctx = ctx;
    this.minRank = LEVEL_RANK[level];
    this.traceId = traceId;
  }

  /**
   * Returns a new Logger instance bound to the given traceId.
   * Use this in request handlers to propagate the trace context:
   *
   *   const log = createLogger("MyController").withTraceId(req.headers["x-trace-id"]);
   *
   * Future: replace with OpenTelemetry context propagation (ENABLE_TRACING=true).
   */
  withTraceId(traceId: string): Logger {
    return new Logger(this.ctx, _configuredLevel, traceId);
  }

  private emit(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    if (LEVEL_RANK[level] < this.minRank) return;
    const line = format(level, this.ctx, message, meta, this.traceId);
    if (level === "error" || level === "warn") {
      console.error(line);
    } else {
      console.log(line);
    }
    appendToFile(line);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.emit("debug", message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.emit("info", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.emit("warn", message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.emit("error", message, meta);
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Creates a Logger scoped to the given context (class or module name).
 * The log level is read from the environment at module load time.
 */
export function createLogger(ctx: string): Logger {
  return new Logger(ctx);
}
