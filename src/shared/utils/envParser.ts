/**
 * Pure utility functions for parsing and serializing `.env` files.
 *
 * No filesystem access — callers are responsible for reading / writing the file.
 * Compatible with the dotenv line format:
 *   KEY=value          — simple assignment
 *   # comment          — ignored
 *   (blank line)       — preserved
 *   KEY="quoted value" — quotes stripped
 */

/** Represents a parsed key=value entry. */
export interface EnvEntry {
  key: string;
  value: string;
}

/**
 * Parse a `.env` file string into key-value pairs.
 *
 * Rules:
 * - Lines starting with `#` are comments and are skipped.
 * - Lines without `=` are skipped.
 * - Duplicate keys: the LAST occurrence wins (mirrors dotenv behaviour).
 * - Surrounding quotes (`"` or `'`) around the value are stripped.
 */
export function parseEnvFile(content: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    if (!key) continue;
    const raw_value = line.slice(eqIdx + 1);
    result.set(key, stripQuotes(raw_value));
  }
  return result;
}

/** Strip surrounding `"` or `'` from a value string. */
function stripQuotes(value: string): string {
  const v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

/**
 * Apply a set of updates to an existing `.env` file string while preserving
 * comments and unrelated lines.
 *
 * Behaviour:
 * - Keys present in `updates` with a non-null value: overwrite first occurrence,
 *   remove subsequent duplicates.
 * - Keys present in `updates` with `null`: delete all occurrences.
 * - Keys NOT in `updates`: left unchanged (including non-whitelisted secrets).
 * - New keys (not already in the file) are appended at the end.
 */
export function applyEnvUpdates(
  original: string,
  updates: Map<string, string | null>,
): string {
  const lines = original.split("\n");
  const handledKeys = new Set<string>();
  const result: string[] = [];

  for (const raw of lines) {
    const trimmed = raw.trim();

    // Preserve blank lines and comments as-is
    if (!trimmed || trimmed.startsWith("#")) {
      result.push(raw);
      continue;
    }

    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) {
      result.push(raw);
      continue;
    }

    const key = trimmed.slice(0, eqIdx).trim();

    if (!updates.has(key)) {
      // Not in the update set — keep as-is
      result.push(raw);
      continue;
    }

    if (handledKeys.has(key)) {
      // Duplicate key that was already handled — drop it
      continue;
    }

    handledKeys.add(key);
    const newValue = updates.get(key);

    if (newValue === null) {
      // Delete: skip this line
      continue;
    }

    // Replace: emit updated line
    result.push(`${key}=${newValue}`);
  }

  // Append brand-new keys that were not present in the original file
  for (const [key, value] of updates) {
    if (!handledKeys.has(key) && value !== null) {
      result.push(`${key}=${value}`);
    }
  }

  // Ensure file ends with a single newline
  const joined = result.join("\n");
  return joined.endsWith("\n") ? joined : joined + "\n";
}
