"use client";

/**
 * DebugContext — collects API call traces for the admin debug panel.
 *
 * Usage:
 *   1. Wrap admin pages with <DebugProvider enabled={debugEnabled}>
 *   2. Call addTrace() from fetch wrappers or handlers
 *   3. Render <DebugPanel> at the bottom of the page
 */

import { createContext, useCallback, useContext, useState } from "react";

export interface DebugTrace {
  id:           string;
  timestamp:    number;
  method:       string;
  url:          string;
  status:       number | null;
  durationMs:   number | null;
  requestBody?: string;
  responseBody?: string;
  error?:       string;
}

/** Input shape for addTrace — all optional fields are truly optional (no exactOptionalPropertyTypes issue). */
interface DebugTraceInput {
  method:       string;
  url:          string;
  status:       number | null;
  durationMs:   number | null;
  requestBody?: string;
  responseBody?: string;
  error?:       string;
}

interface DebugContextValue {
  traces:   DebugTrace[];
  addTrace: (trace: DebugTraceInput) => void;
  clear:    () => void;
}

const DebugContext = createContext<DebugContextValue>({
  traces:   [],
  addTrace: () => undefined,
  clear:    () => undefined,
});

const MAX_TRACES = 50;

export function DebugProvider({
  children,
  enabled,
}: {
  children: React.ReactNode;
  enabled:  boolean;
}) {
  const [traces, setTraces] = useState<DebugTrace[]>([]);

  const addTrace = useCallback((trace: DebugTraceInput) => {
    if (!enabled) return;
    setTraces((prev) => [
      { ...trace, id: crypto.randomUUID(), timestamp: Date.now() },
      ...prev,
    ].slice(0, MAX_TRACES));
  }, [enabled]);

  const clear = useCallback(() => setTraces([]), []);

  return (
    <DebugContext.Provider value={{ traces, addTrace, clear }}>
      {children}
    </DebugContext.Provider>
  );
}

export function useDebugContext(): DebugContextValue {
  return useContext(DebugContext);
}

/**
 * Wraps a fetch call and records the trace to DebugContext.
 * Only active when debug mode is enabled.
 */
export async function tracedFetch(
  addTrace: DebugContextValue["addTrace"],
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  const rawBody = typeof init?.body === "string" ? init.body : undefined;
  const start = performance.now();

  try {
    const res = await fetch(url, init);
    const durationMs = Math.round(performance.now() - start);
    const cloned = res.clone();
    const rawResponse = await cloned.text().catch(() => undefined);
    addTrace({
      method, url, status: res.status, durationMs,
      ...(rawBody     !== undefined && { requestBody:  rawBody }),
      ...(rawResponse !== undefined && { responseBody: rawResponse }),
    });
    return res;
  } catch (err: unknown) {
    const durationMs = Math.round(performance.now() - start);
    addTrace({
      method, url, status: null, durationMs,
      ...(rawBody !== undefined && { requestBody: rawBody }),
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
