"use client";

/**
 * DebugPanel — admin-only panel showing API request/response traces.
 *
 * Only rendered when ORDERENTRY_DEBUG__ENABLED=true.
 * Never shown to non-admin users (gated at API level and by useDebugMode).
 */

import { useState } from "react";
import { useDebugContext } from "@/presentation/context/DebugContext";
import type { DebugTrace } from "@/presentation/context/DebugContext";

function statusColor(status: number | null): string {
  if (status === null) return "text-zt-danger";
  if (status < 300)    return "text-zt-success";
  if (status < 400)    return "text-zt-info";
  if (status < 500)    return "text-zt-warning-text";
  return "text-zt-danger";
}

function TraceRow({ trace }: { trace: DebugTrace }) {
  const [expanded, setExpanded] = useState(false);
  const time = new Date(trace.timestamp).toLocaleTimeString("de-CH");

  return (
    <div className="border-b border-zt-border/50 last:border-0">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-1.5 text-left hover:bg-zt-bg-muted/50 transition-colors cursor-pointer"
      >
        <span className="text-[10px] text-zt-text-tertiary font-mono w-16 shrink-0">{time}</span>
        <span className="text-[11px] font-mono font-medium text-zt-primary w-12 shrink-0">{trace.method}</span>
        <span className={`text-[11px] font-mono font-medium w-8 shrink-0 ${statusColor(trace.status)}`}>
          {trace.status ?? "ERR"}
        </span>
        <span className="text-[11px] font-mono text-zt-text-secondary truncate flex-1">{trace.url}</span>
        {trace.durationMs !== null && (
          <span className="text-[10px] text-zt-text-tertiary font-mono shrink-0">{trace.durationMs}ms</span>
        )}
        <span className="text-[10px] text-zt-text-tertiary">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-2 space-y-1">
          {trace.error && (
            <pre className="text-[11px] font-mono text-zt-danger bg-zt-danger-light/30 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
              {trace.error}
            </pre>
          )}
          {trace.requestBody && (
            <div>
              <p className="text-[10px] font-medium text-zt-text-tertiary mb-0.5">Request</p>
              <pre className="text-[11px] font-mono text-zt-text-secondary bg-zt-bg-page rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-32">
                {tryPrettyJson(trace.requestBody)}
              </pre>
            </div>
          )}
          {trace.responseBody && (
            <div>
              <p className="text-[10px] font-medium text-zt-text-tertiary mb-0.5">Response</p>
              <pre className="text-[11px] font-mono text-zt-text-secondary bg-zt-bg-page rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-48">
                {tryPrettyJson(trace.responseBody)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function tryPrettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function DebugPanel() {
  const { traces, clear } = useDebugContext();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="mt-6 border border-zt-warning-text/30 rounded-xl overflow-hidden bg-zt-bg-card">
      <div className="flex items-center justify-between px-4 py-2 bg-zt-warning-bg border-b border-zt-warning-text/30">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-zt-warning-text animate-pulse" />
          <span className="text-[11px] font-medium text-zt-warning-text">Debug Mode</span>
          <span className="text-[10px] text-zt-text-tertiary">({traces.length} traces)</span>
        </div>
        <div className="flex items-center gap-2">
          {traces.length > 0 && (
            <button
              onClick={clear}
              className="text-[10px] text-zt-text-tertiary hover:text-zt-danger transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="text-[10px] text-zt-text-tertiary hover:text-zt-text-primary transition-colors cursor-pointer"
          >
            {collapsed ? "▼ Expand" : "▲ Collapse"}
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="max-h-64 overflow-y-auto">
          {traces.length === 0 ? (
            <p className="px-4 py-3 text-[11px] text-zt-text-tertiary">Keine API-Traces vorhanden.</p>
          ) : (
            traces.map((t) => <TraceRow key={t.id} trace={t} />)
          )}
        </div>
      )}
    </div>
  );
}
