/**
 * Authenticated fetch wrapper for client-side auth API calls.
 *
 * Why this exists:
 *  - Always sends credentials (cookies) with every request.
 *  - Logs every request and response via logAuth so auth failures are visible
 *    in both browser DevTools console and server stdout.
 *  - Throws on non-2xx with a message that includes the HTTP status and the
 *    raw response body — no silent swallowing of errors.
 *  - Parses JSON when the response is JSON; returns raw text otherwise.
 *
 * Only use this for auth-related API calls (/api/login, /api/logout, /api/me).
 * All other API calls go through HttpClient (infrastructure layer).
 */
import { logAuth } from "@/lib/logAuth";

export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const method = options.method ?? "GET";

  logAuth("API_REQUEST", { url, method });

  const res = await fetch(url, {
    ...options,
    credentials: "include",
  });

  const text = await res.text();

  logAuth("API_RESPONSE", {
    url,
    status: res.status,
    statusText: res.statusText,
    ok: res.ok,
    // Truncate to avoid flooding the console with large FHIR payloads
    body: text.length > 500 ? `${text.slice(0, 500)}…` : text,
  });

  if (!res.ok) {
    // Extract the `error` field if the body is JSON (e.g. { ok: false, error: "..." }).
    // Fall back to the raw text if parsing fails (e.g. HTML error pages from proxies).
    let serverMessage = text;
    try {
      const json = JSON.parse(text) as { error?: string };
      if (typeof json.error === "string" && json.error) serverMessage = json.error;
    } catch {
      // keep raw text
    }
    throw new Error(`${res.status}: ${serverMessage}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}
