/**
 * Thin HTTP client for client-side calls to Next.js API routes.
 * Lives in infrastructure so that domain and application layers
 * never import fetch or browser globals directly.
 */
export class HttpClient {
  constructor(private readonly baseUrl: string = "") {}

  async get<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
    const url = new URL(this.baseUrl + path, window.location.origin);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
      }
    }
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${url.pathname}`);
    return res.json() as Promise<T>;
  }

  async delete(path: string): Promise<void> {
    const res = await fetch(this.baseUrl + path, { method: "DELETE", cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} — DELETE ${path}`);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(this.baseUrl + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} — POST ${path}`);
    return res.json() as Promise<T>;
  }
}
