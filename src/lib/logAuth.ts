/**
 * Structured logger for authentication events.
 *
 * Works in both server (Node.js) and client (browser) contexts.
 * Every entry includes a UTC timestamp so logs from Docker and Vercel
 * can be correlated without clock-skew confusion.
 *
 * Usage:
 *   logAuth("LOGIN_ATTEMPT", { username });
 *   logAuth("LOGIN_SUCCESS", { username, userId });
 *   logAuth("LOGIN_ERROR",   { error: err.message, status: 503 });
 */
export function logAuth(event: string, data?: Record<string, unknown>): void {
  console.log(`[AUTH] ${event}`, {
    timestamp: new Date().toISOString(),
    ...data,
  });
}
