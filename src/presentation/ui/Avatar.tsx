/**
 * Avatar — displays a user's initials in a colored circle.
 *
 * Pure presentational. No auth logic, no data fetching.
 * Use only for runtime CSS/SVG coloring; for normal JSX use zt-* Tailwind classes.
 */

// ── Size map ─────────────────────────────────────────────────────────────────

const SIZE: Record<"sm" | "md" | "lg", { outer: string; text: string }> = {
  sm: { outer: "h-6 w-6",   text: "text-[10px] font-semibold" },
  md: { outer: "h-8 w-8",   text: "text-xs    font-semibold" },
  lg: { outer: "h-10 w-10", text: "text-sm    font-semibold" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Derive up to two initials from a username. */
function initials(username: string): string {
  const parts = username.trim().split(/[\s._@-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AvatarProps {
  username: string;
  /** Optional URL — renders an <img> instead of initials if provided. */
  imageUrl?: string;
  size?: "sm" | "md" | "lg";
  /** Extra class names passed to the outer element. */
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Avatar({ username, imageUrl, size = "md", className = "" }: AvatarProps) {
  const { outer, text } = SIZE[size];
  const label = initials(username);

  const base =
    `inline-flex items-center justify-center rounded-full select-none shrink-0 ${outer} ${className}`;

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={username}
        className={`${base} object-cover`}
        aria-hidden="true"
      />
    );
  }

  return (
    <span
      className={`${base} bg-zt-primary text-zt-text-on-primary ${text}`}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}
