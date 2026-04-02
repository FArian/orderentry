"use client";

// ── Skeleton row ──────────────────────────────────────────────────────────────

interface SkeletonRowProps {
  columns?: number;
  rows?: number;
}

/**
 * Animated placeholder rows for table loading states.
 *
 * @example
 * <SkeletonRows rows={8} columns={5} />
 */
export function SkeletonRows({ columns = 5, rows = 6 }: SkeletonRowProps) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i} aria-hidden="true">
          {Array.from({ length: columns }, (__, j) => (
            <td key={j} className="px-3 py-2.5 border-b border-zt-border">
              <div
                className="h-4 rounded bg-zt-bg-muted animate-pulse"
                style={{ width: `${60 + ((i + j) % 4) * 10}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Skeleton block ────────────────────────────────────────────────────────────

interface SkeletonBlockProps {
  lines?: number;
  className?: string;
}

/**
 * Animated placeholder for text content blocks.
 */
export function SkeletonBlock({ lines = 3, className = "" }: SkeletonBlockProps) {
  const widths = ["100%", "85%", "70%", "90%", "60%"];
  return (
    <div className={`flex flex-col gap-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="h-4 rounded bg-zt-bg-muted animate-pulse"
          style={{ width: widths[i % widths.length] }}
        />
      ))}
    </div>
  );
}

// ── Page-level loading overlay ────────────────────────────────────────────────

/**
 * Full-page centered spinner for route-level loading.
 */
export function PageLoader({ label = "Laden…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-64 flex-col items-center justify-center gap-3 text-zt-text-tertiary"
      role="status"
      aria-label={label}
    >
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-zt-primary border-t-transparent" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
