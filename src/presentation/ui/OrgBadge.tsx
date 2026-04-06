"use client";

/**
 * OrgBadge — compact, consistent organization chip for list views.
 *
 * Shows org name + optional GLN. Adapts styling via `variant`:
 *   "sender"   — primary tint  (Auftraggeber)
 *   "receiver" — neutral tint  (Auftragnehmer)
 *   "default"  — muted
 *
 * Purely presentational — no API calls, no state.
 * Layer: presentation/ui (design system component).
 */

import type { OrganizationRef } from "@/domain/valueObjects/OrganizationRef";

export type OrgBadgeVariant = "sender" | "receiver" | "default";

export interface OrgBadgeProps {
  org: OrganizationRef;
  variant?: OrgBadgeVariant | undefined;
  /** When true, show the GLN beneath the name in a monospace sub-line. */
  showGln?: boolean | undefined;
  className?: string | undefined;
}

const VARIANT_CLASSES: Record<OrgBadgeVariant, string> = {
  sender:   "bg-zt-primary-light text-zt-primary border-zt-primary-border",
  receiver: "bg-zt-info-light text-zt-info border-zt-info-border",
  default:  "bg-zt-bg-muted text-zt-text-secondary border-zt-border",
};

export function OrgBadge({ org, variant = "default", showGln = false, className = "" }: OrgBadgeProps) {
  if (!org.name) return <span className="text-zt-text-tertiary text-[12px]">—</span>;

  return (
    <span
      className={`inline-flex flex-col items-start gap-0 px-2 py-0.5 rounded-md border text-[12px] font-medium leading-tight whitespace-nowrap ${VARIANT_CLASSES[variant]} ${className}`}
      title={org.gln ? `GLN: ${org.gln}` : org.name}
    >
      <span>{org.name}</span>
      {showGln && org.gln && (
        <span className="font-mono text-[10px] opacity-70">{org.gln}</span>
      )}
    </span>
  );
}

/** Renders a dash when org is undefined. */
export function OrgBadgeOrDash({
  org,
  variant,
  showGln,
}: {
  org?: OrganizationRef | undefined;
  variant?: OrgBadgeVariant | undefined;
  showGln?: boolean | undefined;
}) {
  if (!org?.name) return <span className="text-zt-text-tertiary text-[12px]">—</span>;
  return (
    <OrgBadge
      org={org}
      {...(variant !== undefined && { variant })}
      {...(showGln !== undefined && { showGln })}
    />
  );
}
