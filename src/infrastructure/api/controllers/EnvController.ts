/**
 * EnvController — handles GET /api/env and POST /api/env.
 *
 * Cross-environment design:
 *  - GET  reads from `process.env` directly — works on Vercel and Docker alike,
 *         and always reflects the values the running process actually sees.
 *  - POST writes to `.env.local` on disk — only meaningful where the filesystem
 *         is writable (local dev, Docker). On Vercel (read-only FS) it returns
 *         405 Method Not Allowed with a clear explanation.
 *
 * Only variables on the ALLOWED_KEYS whitelist are exposed or modified.
 * Secrets such as AUTH_SECRET are never included.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { parseEnvFile, applyEnvUpdates } from "@/shared/utils/envParser";
import type {
  GetEnvResponseDto,
  UpdateEnvRequestDto,
  UpdateEnvResponseDto,
} from "../dto/EnvDto";

// ── Whitelist ─────────────────────────────────────────────────────────────────

/**
 * Explicit whitelist of server-side keys that may be read and written.
 * NEXT_PUBLIC_* keys are always allowed (checked dynamically).
 *
 * To expose a new variable:
 *  1. Add it here.
 *  2. Add the corresponding EnvConfig getter in infrastructure/config/EnvConfig.ts.
 *  3. Document it in the Environment Variables table in CLAUDE.md.
 */
const ALLOWED_SERVER_KEYS = new Set([
  "FHIR_BASE_URL",
  "LOG_LEVEL",
  "LOG_FILE",
  "ENABLE_TRACING",
  "ZIPKIN_URL",
  "GRAFANA_URL",
  "SASIS_API_BASE",
  "GLN_API_BASE",
  "ALLOW_LOCAL_AUTH",
]);

/** Patterns in key names that are always blocked, regardless of whitelist. */
const BLOCKED_PATTERNS = [/SECRET/i, /PASSWORD/i, /TOKEN/i, /PRIVATE/i];

function isAllowed(key: string): boolean {
  if (BLOCKED_PATTERNS.some((re) => re.test(key))) return false;
  return key.startsWith("NEXT_PUBLIC_") || ALLOWED_SERVER_KEYS.has(key);
}

/** True when running inside a Vercel serverless environment. */
function isVercel(): boolean {
  return !!process.env.VERCEL;
}

// ── Controller ────────────────────────────────────────────────────────────────

export class EnvController {
  private readonly envPath: string;

  constructor(cwd: string = process.cwd()) {
    this.envPath = path.join(cwd, ".env.local");
  }

  // ── GET /api/env ────────────────────────────────────────────────────────────
  //
  // Reads from process.env — the authoritative source in all environments:
  //  - Vercel:     .env.local does not exist at runtime; vars come from the
  //                Vercel dashboard and are injected into process.env.
  //  - Docker:     docker-compose env vars override .env.local file values,
  //                so process.env always wins.
  //  - Local dev:  Next.js merges .env.local into process.env at startup.

  async get(): Promise<GetEnvResponseDto> {
    const vars = Object.entries(process.env)
      .filter(([key]) => isAllowed(key))
      .map(([key, value]) => ({ key, value: value ?? "" }));

    return { vars };
  }

  // ── POST /api/env ───────────────────────────────────────────────────────────

  async update(body: UpdateEnvRequestDto): Promise<UpdateEnvResponseDto> {
    // Guard: Vercel serverless functions run in a read-only filesystem.
    // Env vars must be managed via the Vercel dashboard instead.
    if (isVercel()) {
      return {
        ok: false,
        message:
          "In dieser Umgebung (Vercel) nicht verfügbar. " +
          "Umgebungsvariablen müssen über das Vercel-Dashboard verwaltet werden.",
        httpStatus: 405,
      };
    }

    // Validate: no empty keys
    const emptyKey = body.vars.find((v) => !v.key.trim());
    if (emptyKey !== undefined) {
      return {
        ok: false,
        message: "Ungültige Anfrage: leerer Variablenname.",
        httpStatus: 400,
      };
    }

    // Validate: only whitelisted keys may be written
    const forbidden = body.vars.find((v) => !isAllowed(v.key.trim()));
    if (forbidden !== undefined) {
      return {
        ok: false,
        message: `Nicht erlaubt: "${forbidden.key}" darf nicht geändert werden.`,
        httpStatus: 403,
      };
    }

    // Build update map from the incoming vars
    const incomingKeys = new Set(body.vars.map((v) => v.key.trim()));
    const updates = new Map<string, string | null>();

    for (const { key, value } of body.vars) {
      updates.set(key.trim(), value);
    }

    // Delete whitelisted keys that were present in the file but are now absent
    const content = await this.readFile();
    const existing = parseEnvFile(content);
    for (const key of existing.keys()) {
      if (isAllowed(key) && !incomingKeys.has(key)) {
        updates.set(key, null);
      }
    }

    const updated = applyEnvUpdates(content, updates);

    try {
      await fs.writeFile(this.envPath, updated, "utf8");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        message: `Fehler beim Schreiben der Datei: ${msg}`,
        httpStatus: 500,
      };
    }

    return {
      ok: true,
      message:
        "Gespeichert. Bitte starten Sie die Anwendung bzw. den Container neu, " +
        "damit die Änderungen wirksam werden.",
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async readFile(): Promise<string> {
    try {
      return await fs.readFile(this.envPath, "utf8");
    } catch {
      return "";
    }
  }
}

/** Production singleton. */
export const envController = new EnvController();
