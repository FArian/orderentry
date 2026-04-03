/**
 * GET /api/logs — returns structured log entries from the server log file.
 *
 * Query parameters:
 *   tail    — number of lines to read from the end of the file (default: 200, max: 1000)
 *   level   — filter by minimum level: debug | info | warn | error (default: all)
 *   search  — filter entries whose `msg` or `ctx` contains this string (case-insensitive)
 *
 * Response shape:
 *   {
 *     enabled: boolean,          // true when LOG_FILE is configured
 *     logFile: string,           // masked file path (basename only, for security)
 *     total: number,             // total entries after filtering
 *     entries: LogEntry[]
 *   }
 *
 * Security: LOG_FILE is server-only; only the basename is returned in the response.
 * Secrets are never logged and thus never appear in the file.
 */

import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { EnvConfig } from "@/infrastructure/config/EnvConfig";
import { getAdminSession } from "@/lib/auth";

// ── Types ──────────────────────────────────────────────────────────────────────

interface LogEntry {
  time:   string;
  level:  string;
  ctx:    string;
  msg:    string;
  [key: string]: unknown;
}

const LEVEL_RANK: Record<string, number> = {
  debug: 0, info: 1, warn: 2, error: 3,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function readLastLines(filePath: string, n: number): string[] {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n").filter((l) => l.trim() !== "");
    return lines.slice(-n);
  } catch {
    return [];
  }
}

function parseEntry(raw: string): LogEntry | null {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (typeof obj.time !== "string" || typeof obj.level !== "string") return null;
    return obj as LogEntry;
  } catch {
    return null;
  }
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json(
      { type: "about:blank", title: "Forbidden", status: 403, detail: "Admin access required", instance: "/api/logs" },
      { status: 403 },
    );
  }

  const { logFile } = EnvConfig;

  if (!logFile) {
    return NextResponse.json({
      enabled: false,
      logFile: null,
      total: 0,
      entries: [],
    });
  }

  const { searchParams } = request.nextUrl;

  const tail   = Math.min(Math.max(1, Number(searchParams.get("tail")  ?? 200)), 1000);
  const level  = searchParams.get("level")  ?? "";
  const search = (searchParams.get("search") ?? "").toLowerCase();

  const rawLines = readLastLines(logFile, tail);
  let entries: LogEntry[] = rawLines.map(parseEntry).filter((e): e is LogEntry => e !== null);

  // Filter by minimum level
  if (level && level in LEVEL_RANK) {
    const minRank = LEVEL_RANK[level]!;
    entries = entries.filter((e) => (LEVEL_RANK[e.level] ?? -1) >= minRank);
  }

  // Filter by search text (message or context)
  if (search) {
    entries = entries.filter(
      (e) =>
        e.msg.toLowerCase().includes(search) ||
        e.ctx.toLowerCase().includes(search),
    );
  }

  return NextResponse.json({
    enabled:  true,
    logFile:  path.basename(logFile),   // Return basename only — never expose full server path
    total:    entries.length,
    entries:  entries.reverse(),        // Newest first
  });
}
