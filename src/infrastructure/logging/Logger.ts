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
  process.env[`${(process.env.APP_NAME ?? "ORDERENTRY").toUpperCase()}_LOG__LEVEL`] ?? "info",
);
const _logFile: string | null =
  (process.env[`${(process.env.APP_NAME ?? "ORDERENTRY").toUpperCase()}_LOG__FILE`] ?? "").trim() || null;

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
    ...(traceId ? { traceId } : {}),
    ...meta,
  };
  return JSON.stringify(entry);
}

// ── File appender (optional) ──────────────────────────────────────────────────

function appendToFile(line: string): void {
  if (!_logFile) return;
  if (typeof window !== "undefined") return; // browser — no file I/O
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs   = require("fs")   as typeof import("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path") as typeof import("path");
    const dir  = path.dirname(_logFile);
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
   * Returns a new Logger instance bound to an explicit traceId.
   * Useful when you have the traceId from an incoming header and want to
   * pin it to all log lines in a request handler before OTel context is set:
   *
   *   const log = createLogger("MyController").withTraceId(req.headers["x-trace-id"]);
   *
   * When ENABLE_TRACING=true the active OpenTelemetry span is read automatically
   * via getActiveTraceId() — withTraceId() is only needed for manual overrides.
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
