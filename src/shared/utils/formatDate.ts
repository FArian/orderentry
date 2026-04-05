/**
 * Format an ISO date string as DD.MM.YYYY (Swiss/German convention).
 * Returns an empty string for falsy input; returns the original string
 * if it cannot be parsed as a valid date.
 */
export function formatDate(date?: string | null): string {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${d.getFullYear()}`;
}

/**
 * Format an ISO date string as a human-readable date, e.g. "31 Mrz 2026".
 * Uses the locale of the runtime environment (de-CH by default).
 * Returns an empty string for falsy or invalid input.
 */
export function formatReadableDate(date?: string | null, locale = "de-CH"): string {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    day:   "numeric",
    month: "short",
    year:  "numeric",
  }).format(d);
}
