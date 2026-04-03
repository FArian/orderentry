// Colors: blue #0A63C9, light-blue #8DB2E6, purple #A85AAE
import React from "react";

export type ZetLabLogoProps = {
  /** Overall height of the logo (any valid CSS size). */
  height?: number | string;
  /** Additional className passed to the <svg>. */
  className?: string;
  /** Accessible label. */
  ariaLabel?: string;
  /** Optional <title> text for tooltips. */
  title?: string;
  /** Hide the wordmark and show only the icon square. */
  iconOnly?: boolean;
  /** Override colors if desired. */
  colors?: {
    blue?: string; // triangle
    lightBlue?: string; // diagonal + wordmark
    purple?: string; // top bar + period
  };
};

const DEFAULTS = {
  blue: "#0A63C9",
  lightBlue: "#8DB2E6",
  purple: "#A85AAE",
};

export default function ZetLabLogo({
  height = 80,
  className,
  ariaLabel = "z2Lab logo",
  title = "z2Lab logo",
  iconOnly = false,
  colors = {},
}: ZetLabLogoProps) {
  const palette: { blue: string; lightBlue: string; purple: string } = {
    ...DEFAULTS,
    ...(colors ?? {}),
  };

  // If iconOnly, shrink the viewBox to the 64x64 emblem; otherwise leave room for wordmark
  const viewBox = iconOnly ? "0 0 64 64" : "0 0 500 80";

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      className={className}
      style={{ height, width: "auto", display: "block" }}
    >
      <title>{title}</title>
      <desc>
        Stylized Z built from a blue triangle, a light-blue diagonal stroke, and a purple rounded
        bar; followed by a light-blue &quot;etLab&quot; wordmark and a purple period.
      </desc>

      {/* Emblem container (64x64) */}
      <g id="emblem">
        {/* Base right-angled triangle filling bottom-left */}
        <path d="M0 0 L0 64 L64 64 Z" fill={palette.blue} />

        {/* Diagonal middle stroke of the Z */}
        <line
          x1={10}
          y1={6}
          x2={58}
          y2={64}
          stroke={palette.lightBlue}
          strokeWidth={12}
          strokeLinecap="round"
        />

        {/* Top bar of the Z (rounded) */}
        <rect x={8} y={8} width={48} height={12} rx={6} fill={palette.purple} />
      </g>

      {!iconOnly && (
        <g id="wordmark" transform="translate(82, 0)">
          <text
            x={0}
            y={64}
            fontFamily={"Inter, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"}
            fontWeight={300}
            fontSize={52}
            letterSpacing={0.5}
            fill={palette.lightBlue}
            dominantBaseline="alphabetic"
          >
            <tspan>etLab</tspan>
            <tspan fill={palette.purple}>.</tspan>
          </text>
        </g>
      )}
    </svg>
  );
}
