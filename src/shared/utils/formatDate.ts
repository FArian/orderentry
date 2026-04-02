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
