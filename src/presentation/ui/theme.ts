/**
 * z2Lab TypeScript token reference.
 *
 * Use these values only when you need a color string at runtime
 * (e.g. inline Canvas/SVG drawing). For all normal JSX styling,
 * use the Tailwind utility classes generated from the CSS tokens:
 *
 *   bg-zt-primary        text-zt-text-primary   border-zt-border
 *   bg-zt-success-light  text-zt-text-secondary border-zt-primary-border
 *   bg-zt-critical-light text-zt-critical        border-zt-critical-border
 *   …etc.
 *
 * NEVER import this file inside `domain/` or `application/`.
 */
export const theme = {
  colors: {
    primary:        "var(--zt-primary)",
    primaryLight:   "var(--zt-primary-light)",
    primaryBorder:  "var(--zt-primary-border)",
    primaryHover:   "var(--zt-primary-hover)",

    success:        "var(--zt-success)",
    successLight:   "var(--zt-success-light)",
    successBorder:  "var(--zt-success-border)",
    successHover:   "var(--zt-success-hover)",

    danger:         "var(--zt-danger)",
    dangerLight:    "var(--zt-danger-light)",
    dangerBorder:   "var(--zt-danger-border)",
    dangerHover:    "var(--zt-danger-hover)",

    warningText:    "var(--zt-warning-text)",
    warningBg:      "var(--zt-warning-bg)",
    warningBorder:  "var(--zt-warning-border)",

    /** Life-threatening / critical lab values — distinct from danger */
    critical:       "var(--zt-critical)",
    criticalLight:  "var(--zt-critical-light)",
    criticalBorder: "var(--zt-critical-border)",
    criticalHover:  "var(--zt-critical-hover)",

    /** Urgent / STAT orders — time-critical */
    urgent:         "var(--zt-urgent)",
    urgentLight:    "var(--zt-urgent-light)",
    urgentBorder:   "var(--zt-urgent-border)",
    urgentHover:    "var(--zt-urgent-hover)",

    /** Preliminary results, active orders */
    info:           "var(--zt-info)",
    infoLight:      "var(--zt-info-light)",
    infoBorder:     "var(--zt-info-border)",
    infoHover:      "var(--zt-info-hover)",

    /** Amended or corrected lab reports */
    amended:        "var(--zt-amended)",
    amendedLight:   "var(--zt-amended-light)",
    amendedBorder:  "var(--zt-amended-border)",
    amendedHover:   "var(--zt-amended-hover)",

    bgPage:         "var(--zt-bg-page)",
    bgCard:         "var(--zt-bg-card)",
    bgMuted:        "var(--zt-bg-muted)",

    border:         "var(--zt-border)",
    borderStrong:   "var(--zt-border-strong)",

    textPrimary:    "var(--zt-text-primary)",
    textSecondary:  "var(--zt-text-secondary)",
    textTertiary:   "var(--zt-text-tertiary)",
    textDisabled:   "var(--zt-text-disabled)",
    textOnPrimary:  "var(--zt-text-on-primary)",
  },
} as const;
