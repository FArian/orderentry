/**
 * ConfigController — handles GET /api/config and POST /api/config.
 *
 * Implements the runtime override layer:
 *   resolved value = process.env ?? config.json override ?? default
 *
 * Cross-environment design:
 *   GET  → always works; returns resolved values + source metadata.
 *   POST → guarded on Vercel (read-only / ephemeral filesystem → 405).
 *          On Docker / local dev, writes to data/config.json immediately.
 *          No restart required — overrides take effect on the next request.
 */

import {
  SUPPORTED_KEYS,
  DEFAULTS,
  getAll,
  saveOverrides,
  type SupportedKey,
} from "@/infrastructure/config/RuntimeConfig";
import { createLogger } from "@/infrastructure/logging/Logger";

const log = createLogger("ConfigController");
import type {
  ConfigEntryDto,
  GetConfigResponseDto,
  UpdateConfigRequestDto,
  UpdateConfigResponseDto,
} from "../dto/ConfigDto";

/** True when running inside a Vercel serverless environment. */
function isVercel(): boolean {
  return !!process.env.VERCEL;
}

export class ConfigController {
  private readonly cwd: string;

  constructor(cwd = process.cwd()) {
    this.cwd = cwd;
  }

  // ── GET /api/config ─────────────────────────────────────────────────────────

  async get(): Promise<GetConfigResponseDto> {
    const { resolved, overrides } = await getAll(this.cwd);

    const entries: ConfigEntryDto[] = SUPPORTED_KEYS.map((key) => {
      const override = overrides[key] ?? null;
      const envValue = process.env[key] ?? null;
      const defaultValue = DEFAULTS[key];
      // ENV always wins — if process.env is set, show "locked" regardless of override.
      const source =
        envValue !== null ? "locked" :
        override !== null ? "override" :
        "default";

      return {
        key,
        value: resolved[key],
        override,
        envValue,
        defaultValue,
        source,
      };
    });

    return { entries };
  }

  // ── POST /api/config ────────────────────────────────────────────────────────

  async update(body: UpdateConfigRequestDto): Promise<UpdateConfigResponseDto> {
    if (isVercel()) {
      return {
        ok: false,
        message:
          "In dieser Umgebung (Vercel) nicht verfügbar. " +
          "Overrides können auf Vercel nicht gespeichert werden.",
        httpStatus: 405,
      };
    }

    // Validate: only supported keys are accepted
    const invalidKeys = Object.keys(body.overrides).filter(
      (k) => !SUPPORTED_KEYS.includes(k as SupportedKey),
    );
    if (invalidKeys.length > 0) {
      return {
        ok: false,
        message: `Ungültige Schlüssel: ${invalidKeys.join(", ")}`,
        httpStatus: 400,
      };
    }

    try {
      await saveOverrides(
        body.overrides as Partial<Record<SupportedKey, string | null>>,
        this.cwd,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error("saveOverrides failed", { message: msg });
      return {
        ok: false,
        message: `Fehler beim Speichern: ${msg}`,
        httpStatus: 500,
      };
    }

    return {
      ok: true,
      message: "Overrides gespeichert. Änderungen sind sofort wirksam.",
    };
  }
}

/** Production singleton. */
export const configController = new ConfigController();
